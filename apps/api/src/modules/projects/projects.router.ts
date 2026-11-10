import { createProjectSchema, updateProjectSchema } from "@documento/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/init";
import { managedProjectProcedure, projectProcedure } from "./project-procedure";
import { projectsService } from "./projects.service";

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => projectsService.list(ctx.actor)),

  create: protectedProcedure
    .input(createProjectSchema)
    .mutation(({ ctx, input }) => projectsService.create(ctx.actor, input)),

  get: projectProcedure.query(({ ctx }) => ctx.project),

  update: protectedProcedure
    .input(updateProjectSchema)
    .mutation(({ ctx, input }) => projectsService.update(ctx.actor, input)),

  /** Permanent delete; the client must send the exact project name. */
  delete: managedProjectProcedure
    .input(z.object({ confirmName: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      projectsService.remove(ctx.actor, ctx.project.id, input.confirmName),
    ),

  archive: managedProjectProcedure.mutation(({ ctx }) =>
    projectsService.archive(ctx.actor, ctx.project.id),
  ),

  /** Owner or superadmin hands the project over; the previous owner stays on as a member. */
  transferOwner: managedProjectProcedure
    .input(z.object({ newOwnerId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      projectsService.transferOwner(ctx.actor, ctx.project.id, input.newOwnerId),
    ),
});
