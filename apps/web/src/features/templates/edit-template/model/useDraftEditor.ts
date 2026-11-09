import { sampleFromSchema, type TemplateSchema } from "@documento/shared";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { TemplateDraft } from "@/entities/template";
import { getErrorMessage, trpc } from "@/shared/api";
import { notify } from "@/shared/lib";
import { invalidateTemplateQueries } from "../../invalidate";

type Snapshot = {
  source: string;
  schema: TemplateSchema;
  sampleText: string;
  renderTimeoutSec: number;
  maxPayloadKb: number;
};

const toSnapshot = (d: TemplateDraft): Snapshot => ({
  source: d.source,
  schema: d.schema,
  sampleText: JSON.stringify(d.sampleData, null, 2),
  renderTimeoutSec: d.renderTimeoutSec,
  maxPayloadKb: d.maxPayloadKb,
});

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

  /** Saves the form; returns false (after a toast) when the sample JSON is not an object. */
  async function save(): Promise<boolean> {
    let sampleData: unknown;
    try {
      sampleData = JSON.parse(form.sampleText || "{}");
    } catch {
      notify.error("Namuna ma'lumot to'g'ri JSON emas");
      return false;
    }
    if (typeof sampleData !== "object" || sampleData === null || Array.isArray(sampleData)) {
      notify.error("Namuna ma'lumot obyekt bo'lishi kerak");
      return false;
    }
    try {
      await saveMutation.mutateAsync({
        projectId,
        templateId,
        source: form.source,
        schema: form.schema,
        sampleData: sampleData as Record<string, unknown>,
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
    fillSample: () => patch({ sampleText: JSON.stringify(sampleFromSchema(form.schema), null, 2) }),
  };
}
