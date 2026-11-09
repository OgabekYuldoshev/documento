import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { TemplateDraft } from "@/entities/template";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";
import { sampleTextFromSchema } from "../ui/SchemaEditor";

type Snapshot = {
  source: string;
  schemaText: string;
  sampleText: string;
  renderTimeoutSec: number;
  maxPayloadKb: number;
};

const toSnapshot = (d: TemplateDraft): Snapshot => ({
  source: d.source,
  schemaText: JSON.stringify(d.schema, null, 2),
  sampleText: JSON.stringify(d.sampleData, null, 2),
  renderTimeoutSec: d.renderTimeoutSec,
  maxPayloadKb: d.maxPayloadKb,
});

export type PreviewState =
  | { kind: "ok"; url: string; pages: number; durationMs: number }
  | { kind: "error"; title: string; lines: string[] };

const FAILURE_TITLES: Record<string, string> = {
  validation: "Namuna ma'lumot schemaga mos emas",
  compile: "Typst kompilyatsiya xatosi",
  timeout: "Vaqt limiti tugadi",
  oom: "Xotira limiti yetmadi",
  too_large: "Natija juda katta",
};

type Failure = {
  kind: string;
  errors?: { path: string; message: string }[];
  diagnostics?: { file?: string; line?: number; column?: number; message: string }[];
};

function failureLines(r: Failure): string[] {
  if (r.errors) return r.errors.map((e) => `${e.path || "/"}: ${e.message}`);
  return (r.diagnostics ?? []).map((d) =>
    d.line ? `${d.file ?? "main.typ"}:${d.line}:${d.column ?? 0}  ${d.message}` : d.message,
  );
}

function pdfUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text || "{}");
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return null;
}

const isBreakingConflict = (error: unknown) =>
  error instanceof Error && error.message.startsWith("Buzuvchi o'zgarishlar");

export function useDraftEditor(projectId: string, templateId: string, draft: TemplateDraft) {
  const [saved, setSaved] = useState<Snapshot>(() => toSnapshot(draft));
  const [form, setForm] = useState<Snapshot>(saved);
  const [breaking, setBreaking] = useState<string | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const patch = (p: Partial<Snapshot>) => setForm((f) => ({ ...f, ...p }));

  const saveMutation = useMutation({
    ...trpc.templates.saveDraft.mutationOptions(),
    onError: (error) => notify.error(getErrorMessage(error)),
  });
  const publishMutation = useMutation(trpc.templates.publish.mutationOptions());
  const previewMutation = useMutation(trpc.templates.preview.mutationOptions());
  const [preview, setPreview] = useState<PreviewState | null>(null);

  // Blob URLs are not garbage collected: revoke on replace and on unmount.
  useEffect(
    () => () => {
      if (preview?.kind === "ok") URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const runId = useRef(0);

  /** Renders the unsaved editor state; late answers from older runs are dropped. */
  async function runPreview(manual = true) {
    const id = ++runId.current;
    const sampleData = parseObject(form.sampleText);
    const schema = parseObject(form.schemaText);
    if (!schema || !sampleData) {
      setPreview({
        kind: "error",
        title: "JSON to'g'ri emas",
        lines: [
          ...(schema ? [] : ["Schema to'g'ri JSON obyekt emas"]),
          ...(sampleData ? [] : ["Namuna ma'lumot to'g'ri JSON obyekt emas"]),
        ],
      });
      return;
    }
    try {
      const r = await previewMutation.mutateAsync({
        projectId,
        templateId,
        source: form.source,
        schema,
        sampleData,
        renderTimeoutSec: form.renderTimeoutSec,
      });
      if (id !== runId.current) return;
      if (r.ok) {
        setPreview({
          kind: "ok",
          url: pdfUrl(r.pdfBase64),
          pages: r.pages,
          durationMs: r.durationMs,
        });
      } else {
        setPreview({
          kind: "error",
          title: FAILURE_TITLES[r.kind] ?? "Xatolik",
          lines: failureLines(r as Failure),
        });
      }
    } catch (error) {
      if (manual && id === runId.current) notify.error(getErrorMessage(error));
    }
  }

  // Live preview: re-render shortly after the author stops typing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the inputs below should retrigger
  useEffect(() => {
    const timer = setTimeout(() => void runPreview(false), 800);
    return () => clearTimeout(timer);
  }, [form.source, form.schemaText, form.sampleText, form.renderTimeoutSec]);

  /** Saves the form; returns false (after a toast) when the sample JSON is not an object. */
  async function save(): Promise<boolean> {
    const sampleData = parseObject(form.sampleText);
    if (!sampleData) {
      notify.error("Namuna ma'lumot to'g'ri JSON obyekt emas");
      return false;
    }
    const schema = parseObject(form.schemaText);
    if (!schema) {
      notify.error("Schema to'g'ri JSON obyekt emas");
      return false;
    }
    try {
      await saveMutation.mutateAsync({
        projectId,
        templateId,
        source: form.source,
        schema,
        sampleData,
        renderTimeoutSec: form.renderTimeoutSec,
        maxPayloadKb: form.maxPayloadKb,
      });
    } catch {
      return false;
    }
    setSaved(form);
    await invalidateTemplateQueries();
    return true;
  }

  async function saveOnly() {
    if (await save()) notify.success("Saqlandi");
  }

  async function publish(acknowledgeBreaking = false) {
    if (dirty && !(await save())) return;
    try {
      const { version } = await publishMutation.mutateAsync({
        projectId,
        templateId,
        acknowledgeBreaking,
      });
      setBreaking(null);
      await invalidateTemplateQueries();
      notify.success(`v${version.number} publish qilindi`);
    } catch (error) {
      if (!acknowledgeBreaking && isBreakingConflict(error)) setBreaking(getErrorMessage(error));
      else notify.error(getErrorMessage(error));
    }
  }

  return {
    form,
    patch,
    dirty,
    saving: saveMutation.isPending,
    publishing: publishMutation.isPending,
    breaking,
    dismissBreaking: () => setBreaking(null),
    save: saveOnly,
    publish,
    preview,
    previewing: previewMutation.isPending,
    runPreview: () => runPreview(true),
    fillSample: () => {
      const text = sampleTextFromSchema(form.schemaText);
      if (text) patch({ sampleText: text });
      else notify.error("Schema to'g'ri JSON emas");
    },
  };
}
