import { ASSIGNABLE_ROLES, type CreateUserInput, type Role } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { APIError } from "better-auth/api";
import { auth } from "../../lib/auth";
import { usersRepository } from "./users.repository";

export type Actor = { id: string; role: Role };

function rethrow(error: unknown): never {
  if (error instanceof APIError) {
    const status = Number(error.statusCode);
    const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BAD_REQUEST";
    throw new TRPCError({ code, message: error.message, cause: error });
  }
  throw error;
}

/** Actors may only manage users strictly below their own rank. */
async function assertCanManage(actor: Actor, targetId: string) {
  if (actor.id === targetId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You cannot perform this action on yourself",
    });
  }
  const target = await usersRepository.findById(targetId);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  if (target.role === "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Superadmin is protected" });
  }
  const manageable: readonly string[] = ASSIGNABLE_ROLES[actor.role];
  if (!manageable.includes(target.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions for this user" });
  }
}

export const usersService = {
  list: () => usersRepository.list(),
  recent: (limit: number) => usersRepository.list(limit),
  stats: () => usersRepository.stats(),

  async create(actor: Actor, headers: Headers, input: CreateUserInput) {
    const allowed: readonly string[] = ASSIGNABLE_ROLES[actor.role];
    if (!allowed.includes(input.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `You cannot create a "${input.role}"` });
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
    try {
      await auth.api.removeUser({ headers, body: { userId: id } });
    } catch (error) {
      rethrow(error);
    }
  },
};
