import {
  createTemplateSchema,
  previewSchema,
  publishSchema,
  restoreVersionSchema,
  saveDraftSchema,
} from "@documento/shared";
import { env } from "../../config/env";
import { createInFlightLimiter } from "../../lib/in-flight-limiter";
import { protectedProcedure, router } from "../../trpc/init";
import { assetsService } from "../assets/assets.service";
import { projectProcedure } from "../projects/project-procedure";
import { renderPreview, renderPreviewSvg } from "../render/render.service";
import { templateProcedure } from "./template-procedure";
import { templatesService } from "./templates.service";

/** Editor renders per user: an author typing must not flood the shared render capacity. */
const previewLimiter = createInFlightLimiter(
  env.PREVIEW_MAX_PER_USER,
  "Preview juda tez-tez so'raldi, bir ozdan keyin urinib ko'ring",
);

export const templatesRouter = router({
  recent: protectedProcedure.query(({ ctx }) => templatesService.recent(ctx.actor)),

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
  preview: templateProcedure.input(previewSchema).mutation(({ ctx, input }) =>
    previewLimiter.run(ctx.actor.id, async () => {
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
  ),

  /** Same render as `preview`, but as a real PDF (base64, <= 20 MB) for downloading. */
  previewPdf: templateProcedure.input(previewSchema).mutation(({ ctx, input }) =>
    previewLimiter.run(ctx.actor.id, async () => {
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
  ),

  versions: templateProcedure.query(({ ctx }) => templatesService.versions(ctx.template)),

  restoreVersion: templateProcedure
    .input(restoreVersionSchema)
    .mutation(({ ctx, input }) => templatesService.restoreVersion(ctx.template, input.versionId)),

  archive: templateProcedure.mutation(({ ctx }) => templatesService.archive(ctx.template)),
});
