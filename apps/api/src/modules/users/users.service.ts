import { ASSIGNABLE_ROLES, type CreateUserInput, getRoleLabel, type Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { auth } from "../../lib/auth";
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
}

export const usersService = {
  list: () => usersRepository.list(),
  recent: (limit: number) => usersRepository.list(limit),
  stats: () => usersRepository.stats(),

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
      return { id: user.id };
    } catch (error) {
      rethrow(error);
    }
  },

  async setBanned(actor: Actor, headers: Headers, id: string, banned: boolean) {
    await assertCanManage(actor, id);
    try {
      if (banned) await auth.api.banUser({ headers, body: { userId: id } });
      else await auth.api.unbanUser({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
  },

  async remove(actor: Actor, headers: Headers, id: string) {
    await assertCanManage(actor, id);
    if ((await usersRepository.countOwnedProjects(id)) > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Foydalanuvchining project'lari bor. Avval ularni arxivlang yoki egasini almashtiring",
      });
    }
    try {
      await auth.api.removeUser({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
  },
};
