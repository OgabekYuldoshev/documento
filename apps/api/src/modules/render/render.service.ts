import { readFile } from "node:fs/promises";
import { type TemplateSchema, templateSchemaSchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import { assetsService } from "../assets/assets.service";
import { type DataError, validateData } from "../templates/validate-data";
import type { Diagnostic } from "./diagnostics";
import { createScheduler } from "./scheduler";
import { runTypst } from "./typst-runner";

export const DEFAULT_RENDER_MEMORY_MB = 1024;
export const PREVIEW_MAX_BYTES = 20 * 1024 * 1024;

const scheduler = createScheduler(env.RENDER_MEMORY_BUDGET_MB);

export type RenderInput = {
  source: string;
  schema: TemplateSchema;
  data: unknown;
  timeoutSec: number;
  memoryMb?: number;
  strictWarnings?: boolean;
  maxPayloadBytes?: number;
  assets?: Parameters<typeof runTypst>[0]["assets"];
};

export type RenderFailure =
  | { ok: false; kind: "validation"; errors: DataError[] }
  | {
      ok: false;
      kind: "compile" | "timeout" | "oom" | "too_large";
      diagnostics: Diagnostic[];
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

  const memoryMb = input.memoryMb ?? DEFAULT_RENDER_MEMORY_MB;
  let result: Awaited<ReturnType<typeof runTypst>>;
  try {
    result = await scheduler.run(memoryMb, () =>
      runTypst({
        source: input.source,
        data: checked.data,
        timeoutSec: input.timeoutSec,
        memoryMb,
        strictWarnings: input.strictWarnings,
        assets: input.assets,
      }),
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
    return { ok: false, kind, diagnostics: result.diagnostics };
  }
  return {
    ok: true,
    pdfPath: result.pdfPath,
    bytes: result.bytes,
    pages: result.pages,
    durationMs: result.durationMs,
    dispose: result.dispose,
  };
}

/** Small-PDF variant for the editor preview: returns the bytes and cleans up. */
export async function renderPreview(input: RenderInput): Promise<PreviewResult> {
  const result = await renderToFile(input);
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
