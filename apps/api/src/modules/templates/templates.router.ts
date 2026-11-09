import {
  createTemplateSchema,
  publishSchema,
  restoreVersionSchema,
  saveDraftSchema,
} from "@documento/shared";
import { router } from "../../trpc/init";
import { projectProcedure } from "../projects/project-procedure";
import { templateProcedure } from "./template-procedure";
import { templatesService } from "./templates.service";

export const templatesRouter = router({
  list: projectProcedure.query(({ ctx }) => templatesService.list(ctx.project)),

  create: projectProcedure
    .input(createTemplateSchema)
    .mutation(({ ctx, input }) => templatesService.create(ctx.project, input)),

  get: templateProcedure.query(({ ctx }) => templatesService.get(ctx.template)),

  getDraft: templateProcedure.mutation(({ ctx }) => templatesService.getDraft(ctx.template)),

  saveDraft: templateProcedure
    .input(saveDraftSchema)
    .mutation(({ ctx, input }) => templatesService.saveDraft(ctx.template, input)),

  publish: templateProcedure.input(publishSchema).mutation(({ ctx, input }) =>
    templatesService.publish(ctx.actor, ctx.template, {
      acknowledgeBreaking: input.acknowledgeBreaking,
    }),
  ),

  versions: templateProcedure.query(({ ctx }) => templatesService.versions(ctx.template)),

  restoreVersion: templateProcedure
    .input(restoreVersionSchema)
    .mutation(({ ctx, input }) => templatesService.restoreVersion(ctx.template, input.versionId)),

  archive: templateProcedure.mutation(({ ctx }) => templatesService.archive(ctx.template)),
});
