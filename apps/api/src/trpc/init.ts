import { isAdminRole, type Role } from "@documento/shared";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError, z } from "zod";
import { auth } from "../lib/auth";

export async function createContext({ headers }: { headers: Headers }) {
  const session = await auth.api.getSession({ headers });
  return { headers, session };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? z.flattenError(error.cause) : null,
      },
    };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  const { user } = ctx.session;
  return next({
    ctx: {
      headers: ctx.headers,
      session: ctx.session,
      actor: { id: user.id, role: (user.role ?? "user") as Role },
    },
  });
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminRole(ctx.actor.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next();
});

export const superadminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.actor.role !== "superadmin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Superadmin access required" });
  }
  return next();
});
