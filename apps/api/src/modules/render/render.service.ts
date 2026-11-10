import { readFile } from "node:fs/promises";
import { type TemplateSchema, templateSchemaSchema, transformImages } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import { assetsService } from "../assets/assets.service";
import { PREVIEW_MAX_TOTAL_BYTES, previewsService } from "../previews/previews.service";
import { type DataError, validateData } from "../templates/validate-data";
import { PLACEHOLDER_NAME, PLACEHOLDER_PNG } from "../uploads/placeholder";
import type { Diagnostic } from "./diagnostics";
import { createScheduler, type RenderPriority } from "./scheduler";
import { runTypst } from "./typst-runner";

export const DEFAULT_RENDER_MEMORY_MB = 1024;
export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

// Measured (Typst, table-heavy documents): ~800 MB of RSS per MB of JSON payload plus a base.
const RESERVE_BASE_MB = 64;
const RESERVE_MB_PER_PAYLOAD_MB = 800;
// A decoded raster can take far more than its file size (up to 40 MP of RGBA).
const RESERVE_MB_PER_IMAGE = 128;

/**
 * Memory a render reserves from the scheduler budget. Tiny documents reserve little (many run in
 * parallel); huge payloads reserve a lot, so they queue instead of exhausting RAM. This works on
 * every OS, unlike the `prlimit` cap that only exists on Linux.
 */
export function estimateRenderMb(payloadBytes: number, imageCount: number): number {
  return Math.ceil(
    RESERVE_BASE_MB +
      (payloadBytes / (1024 * 1024)) * RESERVE_MB_PER_PAYLOAD_MB +
      imageCount * RESERVE_MB_PER_IMAGE,
  );
}

const scheduler = createScheduler(env.RENDER_MEMORY_BUDGET_MB);

export type RenderInput = {
  source: string;
  schema: TemplateSchema;
  data: unknown;
  timeoutSec: number;
  memoryMb?: number;
  strictWarnings?: boolean;
  format?: "pdf" | "svg";
  /** Defaults to `production`; editor previews run as `interactive` and never delay documents. */
  priority?: RenderPriority;
  maxPayloadBytes?: number;
  assets?: Parameters<typeof runTypst>[0]["assets"];
  /**
   * Image fields: `files` maps upload id -> stored file (real renders); `placeholder` swaps every
   * image field for a built-in PNG (preview and publish dry-run, where no upload exists).
   */
  images?: { placeholder: true } | { files: Map<string, { ext: string; path: string }> };
};

export type RenderFailure =
  | { ok: false; kind: "validation"; errors: DataError[] }
  | {
      ok: false;
      kind: "compile" | "timeout" | "oom" | "too_large";
      diagnostics: Diagnostic[];
      /** Time the render itself took (not the time spent waiting for the scheduler). */
      durationMs?: number;
    };

export type PreviewResult =
  | { ok: true; pdf: Buffer; pages: number; durationMs: number }
  | RenderFailure;

const tooLarge = (message: string): RenderFailure => ({
  ok: false,
  kind: "too_large",
  diagnostics: [{ severity: "error", message }],
});

export type FileResult =
  | {
      ok: true;
      pdfPath: string;
      svgPaths: string[];
      bytes: number;
      pages: number;
      durationMs: number;
      /** Caller must call this once the file has been moved/read. */
      dispose(): Promise<void>;
    }
  | RenderFailure;

/** Validates data, schedules a Typst run (memory budget) and leaves the PDF on disk. */
export async function renderToFile(input: RenderInput): Promise<FileResult> {
  const checked = validateData(input.schema, input.data, {
    maxPayloadBytes: input.maxPayloadBytes,
  });
  if (!checked.ok) return { ok: false, kind: "validation", errors: checked.errors };

  const extraFiles: NonNullable<Parameters<typeof runTypst>[0]["extraFiles"]> = [];
  let data = checked.data;
  const images = input.images;
  if (images) {
    const used = new Set<string>();
    data = transformImages(input.schema, checked.data, (ref) => {
      if ("placeholder" in images) {
        used.add(PLACEHOLDER_NAME);
        return PLACEHOLDER_NAME;
      }
      const file = images.files.get(ref.id);
      if (!file) throw new Error(`upload ${ref.id} not resolved`);
      const name = `uploads/${ref.id}.${file.ext}`;
      if (!used.has(name)) extraFiles.push({ name, path: file.path });
      used.add(name);
      return name;
    }).data;
    if (used.has(PLACEHOLDER_NAME))
      extraFiles.push({ name: PLACEHOLDER_NAME, bytes: PLACEHOLDER_PNG });
  }

  const estimateMb = estimateRenderMb(
    Buffer.byteLength(JSON.stringify(data)),
    extraFiles.filter((f) => f.name.startsWith("uploads/")).length,
  );
  // A job bigger than the whole budget runs alone (reserves everything) instead of failing.
  const reserveMb = Math.min(estimateMb, env.RENDER_MEMORY_BUDGET_MB);
  // The hard cap (prlimit address space, Linux) must stay well above legitimate use.
  const memoryMb = Math.max(
    input.memoryMb ?? DEFAULT_RENDER_MEMORY_MB,
    Math.ceil(estimateMb * 1.25) + 1024,
  );
  let result: Awaited<ReturnType<typeof runTypst>>;
  try {
    result = await scheduler.run(
      reserveMb,
      () =>
        runTypst({
          source: input.source,
          data,
          extraFiles,
          timeoutSec: input.timeoutSec,
          memoryMb,
          strictWarnings: input.strictWarnings,
          format: input.format,
          assets: input.assets,
        }),
      input.priority,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "render_too_large") {
      return tooLarge("Render xotira byudjetiga sig'maydi");
    }
    throw error;
  }

  if (result.status !== "ok") {
    await result.dispose();
    const kind = result.status === "error" ? "compile" : result.status;
    return { ok: false, kind, diagnostics: result.diagnostics, durationMs: result.durationMs };
  }
  return {
    ok: true,
    pdfPath: result.pdfPath,
    svgPaths: result.svgPaths,
    bytes: result.bytes,
    pages: result.pages,
    durationMs: result.durationMs,
    dispose: result.dispose,
  };
}

/** Small-PDF variant for the editor preview: returns the bytes and cleans up. */
export async function renderPreview(input: RenderInput): Promise<PreviewResult> {
  const result = await renderToFile({ ...input, priority: "interactive" });
  if (!result.ok) return result;
  try {
    if (result.bytes > PREVIEW_MAX_BYTES) {
      return tooLarge("PDF preview uchun juda katta (20 MB dan oshdi)");
    }
    return {
      ok: true,
      pdf: await readFile(result.pdfPath),
      pages: result.pages,
      durationMs: result.durationMs,
    };
  } finally {
    await result.dispose();
  }
}

export type SvgPreviewResult =
  | { ok: true; previewId: string; pages: number; durationMs: number }
  | RenderFailure;

/**
 * Editor preview: one SVG per page (Typst's own vector output, glyphs as paths so no fonts are
 * needed in the browser). Pages are stored by `previewsService` and fetched one by one, so the
 * page count and size are not bound by a response body. The PDF pipeline is untouched.
 */
export async function renderPreviewSvg(
  userId: string,
  input: RenderInput,
): Promise<SvgPreviewResult> {
  const result = await renderToFile({ ...input, format: "svg", priority: "interactive" });
  if (!result.ok) return result;
  try {
    if (result.bytes > PREVIEW_MAX_TOTAL_BYTES) {
      return tooLarge("Preview uchun juda katta (400 MB dan oshdi), PDF'ni yuklab oling");
    }
    const previewId = await previewsService.create(userId, result.svgPaths);
    return { ok: true, previewId, pages: result.pages, durationMs: result.durationMs };
  } finally {
    await result.dispose();
  }
}

const formatDiagnostic = (d: Diagnostic) =>
  d.line ? `${d.file ?? "main.typ"}:${d.line}:${d.column ?? 0} ${d.message}` : d.message;

/** Publish gate: the sample data must render with no errors and no warnings. */
export async function runPublishDryRun(version: {
  templateId?: string;
  source: string;
  schema: unknown;
  sampleData: unknown;
  renderTimeoutSec: number;
  maxPayloadKb: number;
}): Promise<void> {
  const schema = templateSchemaSchema.parse(version.schema);
  const result = await renderPreview({
    source: version.source,
    schema,
    data: version.sampleData,
    timeoutSec: version.renderTimeoutSec,
    strictWarnings: true,
    assets: version.templateId ? await assetsService.forRender(version.templateId) : undefined,
    images: { placeholder: true },
    maxPayloadBytes: version.maxPayloadKb * 1024,
  });
  if (result.ok) return;
  const detail =
    result.kind === "validation"
      ? result.errors.slice(0, 3).map((e) => `${e.path || "/"} ${e.message}`)
      : result.diagnostics.slice(0, 3).map(formatDiagnostic);
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Namuna ma'lumot bilan kompilyatsiya bo'lmadi: ${detail.join("; ")}`,
  });
}
