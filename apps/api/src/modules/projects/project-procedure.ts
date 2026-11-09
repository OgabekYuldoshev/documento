import { projectIdSchema } from "@documento/shared";
import { protectedProcedure } from "../../trpc/init";
import { projectsService } from "./projects.service";

/**
 * Base for every project-scoped procedure. Takes `{ projectId }`, enforces the ownership rule
 * and exposes the loaded row as `ctx.project`. Extend with `.input(...)` to add fields.
 */
export const projectProcedure = protectedProcedure
  .input(projectIdSchema)
  .use(async ({ ctx, input, next }) => {
    const project = await projectsService.get(ctx.actor, input.projectId);
    return next({ ctx: { project } });
  });
