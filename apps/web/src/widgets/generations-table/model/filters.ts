import type { GenerationItem } from "@/entities/generation";

export type GenerationFilters = {
  status: string | null;
  templateId: string | null;
  source: string | null;
  period: string | null;
};

export const NO_FILTERS: GenerationFilters = {
  status: null,
  templateId: null,
  source: null,
  period: null,
};

/** Pseudo status that groups every failure kind. */
export const FAILED = "failed";
const FAILED_STATUSES: readonly string[] = ["validation_error", "render_error", "timeout"];

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIOD_OPTIONS = [
  { value: "today", label: "Bugun" },
  { value: "7d", label: "Oxirgi 7 kun" },
  { value: "30d", label: "Oxirgi 30 kun" },
];

export const SOURCE_OPTIONS = [
  { value: "ui", label: "UI" },
  { value: "api", label: "API" },
];

function periodStart(period: string, now: Date): number | null {
  if (period === "today")
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (period === "7d") return now.getTime() - 7 * DAY_MS;
  if (period === "30d") return now.getTime() - 30 * DAY_MS;
  return null;
}

export const hasFilters = (f: GenerationFilters) => Object.values(f).some(Boolean);

export function applyFilters(rows: GenerationItem[], f: GenerationFilters, now = new Date()) {
  const from = f.period ? periodStart(f.period, now) : null;
  return rows.filter((row) => {
    if (
      f.status === FAILED
        ? !FAILED_STATUSES.includes(row.status)
        : f.status && row.status !== f.status
    ) {
      return false;
    }
    if (f.templateId && row.templateId !== f.templateId) return false;
    if (f.source && row.source !== f.source) return false;
    if (from !== null && row.queuedAt.getTime() < from) return false;
    return true;
  });
}
