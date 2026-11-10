import { createProjectSchema, updateProjectSchema } from "@documento/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../../trpc/init";
import { projectProcedure } from "./project-procedure";
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
  delete: projectProcedure
    .input(z.object({ confirmName: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      projectsService.remove(ctx.actor, ctx.project.id, input.confirmName),
    ),

  archive: projectProcedure.mutation(({ ctx }) =>
    projectsService.archive(ctx.actor, ctx.project.id),
  ),
});
