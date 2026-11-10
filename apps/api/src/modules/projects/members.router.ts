import { addProjectMemberSchema, removeProjectMemberSchema } from "@documento/shared";
import { router } from "../../trpc/init";
import { membersService } from "./members.service";
import { managedProjectProcedure, projectProcedure } from "./project-procedure";

export const projectMembersRouter = router({
  /** Visible to everyone who can open the project. */
  list: projectProcedure.query(({ ctx }) => membersService.list(ctx.project)),

  add: managedProjectProcedure
    .input(addProjectMemberSchema)
    .mutation(({ ctx, input }) => membersService.add(ctx.actor, ctx.project, input.email)),

  /** Managers remove anyone; members can remove themselves. */
  remove: projectProcedure
    .input(removeProjectMemberSchema)
    .mutation(({ ctx, input }) => membersService.remove(ctx.actor, ctx.project, input.userId)),
});
