import { ASSIGNABLE_ROLES, type CreateUserInput, getRoleLabel, type Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { auth } from "../../lib/auth";
import { auditService } from "../audit/audit.service";
import { usersRepository } from "./users.repository";

export type Actor = { id: string; role: Role };

const AUTH_ERRORS: Record<string, string> = {
  USER_ALREADY_EXISTS: "Bu email bilan foydalanuvchi allaqachon mavjud",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Bu email bilan foydalanuvchi allaqachon mavjud",
  PASSWORD_TOO_SHORT: "Parol juda qisqa",
  PASSWORD_TOO_LONG: "Parol juda uzun",
  INVALID_EMAIL: "Email manzili noto'g'ri",
};

function rethrow(error: unknown): never {
  if (error instanceof APIError) {
    const status = Number(error.statusCode);
    const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST";
    const message = AUTH_ERRORS[String(error.body?.code ?? "")] ?? "So'rovni bajarib bo'lmadi";
    throw new TRPCError({ code, message, cause: error });
  }
  throw error;
}

/** Actors may only manage users strictly below their own rank. */
async function assertCanManage(actor: Actor, targetId: string) {
  if (actor.id === targetId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bu amalni o'zingizga nisbatan bajara olmaysiz",
    });
  }
  const target = await usersRepository.findById(targetId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Foydalanuvchi topilmadi" });
  if (target.role === "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Superadmin himoyalangan" });
  }
  const manageable: readonly string[] = ASSIGNABLE_ROLES[actor.role];
  if (!manageable.includes(target.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bu foydalanuvchi ustida amal bajarishga huquqingiz yetmaydi",
    });
  }
  return target;
}

const label = (u: { name: string; email: string }) => `${u.name} <${u.email}>`;

export const usersService = {
  list: () => usersRepository.list(),
  recent: (limit: number) => usersRepository.list(limit),
  stats: () => usersRepository.stats(),

  /** Per-day new and cumulative users for the last `days` days (oldest first, server-local days). */
  async growth(days = 30, now = new Date()) {
    const created = (await usersRepository.createdDates()).map((d) => d.getTime());
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
    return Array.from({ length: days }, (_, i) => {
      const from = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime();
      const to = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1).getTime();
      return {
        date: new Date(from).toISOString(),
        new: created.filter((t) => t >= from && t < to).length,
        total: created.filter((t) => t < to).length,
      };
    });
  },

  async create(actor: Actor, headers: Headers, input: CreateUserInput) {
    const allowed: readonly string[] = ASSIGNABLE_ROLES[actor.role];
    if (!allowed.includes(input.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `"${getRoleLabel(input.role)}" rolini yarata olmaysiz`,
      });
    }
    try {
      const { user } = await auth.api.createUser({
        headers,
        body: { ...input, email: input.email },
      });
      await auditService.record({
        action: "user.created",
        actorId: actor.id,
        targetType: "user",
        targetId: user.id,
        targetLabel: label(input),
        detail: `Rol: ${input.role}`,
      });
      return { id: user.id };
    } catch (error) {
      rethrow(error);
    }
  },

  async setBanned(actor: Actor, headers: Headers, id: string, banned: boolean) {
    const target = await assertCanManage(actor, id);
    try {
      if (banned) await auth.api.banUser({ headers, body: { userId: id } });
      else await auth.api.unbanUser({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
    await auditService.record({
      action: banned ? "user.banned" : "user.unbanned",
      actorId: actor.id,
      targetType: "user",
      targetId: id,
      targetLabel: label(target),
    });
  },

  /** Admin sets a new password for a user below them and signs that user out everywhere. */
  async resetPassword(actor: Actor, headers: Headers, id: string, newPassword: string) {
    const target = await assertCanManage(actor, id);
    try {
      await auth.api.setUserPassword({ headers, body: { userId: id, newPassword } });
      await auth.api.revokeUserSessions({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
    await auditService.record({
      action: "user.password_reset",
      actorId: actor.id,
      targetType: "user",
      targetId: id,
      targetLabel: label(target),
    });
  },

  async remove(actor: Actor, headers: Headers, id: string) {
    const target = await assertCanManage(actor, id);
    if ((await usersRepository.countOwnedProjects(id)) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Foydalanuvchining project'lari bor. Avval ularning egasini almashtiring yoki o'chiring",
      });
    }
    try {
      await auth.api.removeUser({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
    await auditService.record({
      action: "user.removed",
      actorId: actor.id,
      targetType: "user",
      targetId: id,
      targetLabel: label(target),
    });
  },
};
