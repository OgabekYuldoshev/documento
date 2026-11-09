import {
  createTemplateSchema,
  previewSchema,
  publishSchema,
  restoreVersionSchema,
  saveDraftSchema,
} from "@documento/shared";
import { router } from "../../trpc/init";
import { assetsService } from "../assets/assets.service";
import { projectProcedure } from "../projects/project-procedure";
import { renderPreview } from "../render/render.service";
import { templateProcedure } from "./template-procedure";
import { templatesService } from "./templates.service";

export const templatesRouter = router({
  list: projectProcedure.query(({ ctx }) => templatesService.list(ctx.project)),

  create: projectProcedure
    .input(createTemplateSchema)
    .mutation(({ ctx, input }) => templatesService.create(ctx.project, input)),

  get: templateProcedure.query(({ ctx }) => templatesService.get(ctx.template)),

  /** Read-only: the current draft or null. `getDraft` creates one when missing. */
  draft: templateProcedure.query(({ ctx }) => templatesService.findDraft(ctx.template)),

  getDraft: templateProcedure.mutation(({ ctx }) => templatesService.getDraft(ctx.template)),

  saveDraft: templateProcedure
    .input(saveDraftSchema)
    .mutation(({ ctx, input }) => templatesService.saveDraft(ctx.template, input)),

  publish: templateProcedure.input(publishSchema).mutation(({ ctx, input }) =>
    templatesService.publish(ctx.actor, ctx.template, {
      acknowledgeBreaking: input.acknowledgeBreaking,
    }),
  ),

  /** Renders unsaved editor state; the PDF comes back inline (<= 20 MB) as base64. */
  preview: templateProcedure.input(previewSchema).mutation(async ({ ctx, input }) => {
    const result = await renderPreview({
      source: input.source,
      schema: input.schema,
      data: input.sampleData,
      timeoutSec: input.renderTimeoutSec,
      assets: await assetsService.forRender(ctx.template.id),
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      pdfBase64: result.pdf.toString("base64"),
      pages: result.pages,
      durationMs: result.durationMs,
    };
  }),

  versions: templateProcedure.query(({ ctx }) => templatesService.versions(ctx.template)),

  restoreVersion: templateProcedure
    .input(restoreVersionSchema)
    .mutation(({ ctx, input }) => templatesService.restoreVersion(ctx.template, input.versionId)),

  archive: templateProcedure.mutation(({ ctx }) => templatesService.archive(ctx.template)),
});
