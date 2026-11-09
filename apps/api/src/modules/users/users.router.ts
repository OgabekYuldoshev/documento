import { createUserSchema, setBannedSchema, userIdSchema } from "@documento/shared";
import { adminProcedure, router } from "../../trpc/init";
import { usersService } from "./users.service";

export const usersRouter = router({
  list: adminProcedure.query(() => usersService.list()),

  create: adminProcedure
    .input(createUserSchema)
    .mutation(({ ctx, input }) => usersService.create(ctx.actor, ctx.headers, input)),

  setBanned: adminProcedure
    .input(setBannedSchema)
    .mutation(({ ctx, input }) =>
      usersService.setBanned(ctx.actor, ctx.headers, input.id, input.banned),
    ),

  remove: adminProcedure
    .input(userIdSchema)
    .mutation(({ ctx, input }) => usersService.remove(ctx.actor, ctx.headers, input.id)),
});
