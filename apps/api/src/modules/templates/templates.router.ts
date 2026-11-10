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
import { renderPreview, renderPreviewSvg } from "../render/render.service";
import { templateProcedure } from "./template-procedure";
import { templatesService } from "./templates.service";

export const templatesRouter = router({
  list: projectProcedure.query(({ ctx }) => templatesService.list(ctx.project)),

  create: projectProcedure
    .input(createTemplateSchema)
    .mutation(({ ctx, input }) => templatesService.create(ctx.project, input)),

  get: templateProcedure.query(({ ctx }) => templatesService.get(ctx.template)),

  apiExample: templateProcedure.query(({ ctx }) => templatesService.apiExample(ctx.template)),

  /** Read-only: the current draft or null. `getDraft` creates one when missing. */
  draft: templateProcedure.query(({ ctx }) => templatesService.findDraft(ctx.template)),

  current: templateProcedure.query(({ ctx }) => templatesService.findCurrent(ctx.template)),

  getDraft: templateProcedure.mutation(({ ctx }) => templatesService.getDraft(ctx.template)),

  saveDraft: templateProcedure
    .input(saveDraftSchema)
    .mutation(({ ctx, input }) => templatesService.saveDraft(ctx.template, input)),

  publish: templateProcedure.input(publishSchema).mutation(({ ctx, input }) =>
    templatesService.publish(ctx.actor, ctx.template, {
      acknowledgeBreaking: input.acknowledgeBreaking,
    }),
  ),

  /** Renders unsaved editor state; page SVGs are stored and served by /api/previews/:id/:page. */
  preview: templateProcedure.input(previewSchema).mutation(async ({ ctx, input }) => {
    const result = await renderPreviewSvg(ctx.actor.id, {
      source: input.source,
      schema: input.schema,
      data: input.sampleData,
      timeoutSec: input.renderTimeoutSec,
      assets: await assetsService.forRender(ctx.template.id),
      images: { placeholder: true },
    });
    if (!result.ok) return result;
    return {
      ok: true as const,
      previewId: result.previewId,
      pages: result.pages,
      durationMs: result.durationMs,
    };
  }),

  /** Same render as `preview`, but as a real PDF (base64, <= 20 MB) for downloading. */
  previewPdf: templateProcedure.input(previewSchema).mutation(async ({ ctx, input }) => {
    const result = await renderPreview({
      source: input.source,
      schema: input.schema,
      data: input.sampleData,
      timeoutSec: input.renderTimeoutSec,
      assets: await assetsService.forRender(ctx.template.id),
      images: { placeholder: true },
    });
    if (!result.ok) return result;
    return { ok: true as const, pdfBase64: result.pdf.toString("base64") };
  }),

  versions: templateProcedure.query(({ ctx }) => templatesService.versions(ctx.template)),

  restoreVersion: templateProcedure
    .input(restoreVersionSchema)
    .mutation(({ ctx, input }) => templatesService.restoreVersion(ctx.template, input.versionId)),

  archive: templateProcedure.mutation(({ ctx }) => templatesService.archive(ctx.template)),
});
