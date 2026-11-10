import type { GenerationItem } from "./types";

export const GENERATION_STATUS_META: Record<
  GenerationItem["status"],
  { label: string; color: string }
> = {
  queued: { label: "Navbatda", color: "gray" },
  processing: { label: "Jarayonda", color: "blue" },
  ok: { label: "Tayyor", color: "teal" },
  validation_error: { label: "Ma'lumot xato", color: "orange" },
  render_error: { label: "Render xato", color: "red" },
  timeout: { label: "Vaqt tugadi", color: "red" },
  expired: { label: "Muddati o'tgan", color: "gray" },
};

type ErrorJson = {
  errors?: { path: string; message: string }[];
  diagnostics?: { message: string }[];
};

/** First readable failure line (validation error or Typst diagnostic), if any. */
export function getGenerationError(row: { errorJson: unknown }): string | null {
  const e = row.errorJson as ErrorJson | null;
  if (!e) return null;
  const v = e.errors?.[0];
  if (v) return `${v.path || "/"}: ${v.message}`;
  return e.diagnostics?.[0]?.message ?? null;
}
