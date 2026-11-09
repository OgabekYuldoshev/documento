import { createHash } from "node:crypto";
import {
  type BreakingChange,
  DEFAULT_TEMPLATE_SOURCE,
  diffSchemas,
  type SaveDraftInput,
  TEMPLATE_SOURCE_MAX_BYTES,
  templateSchemaSchema,
} from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { db } from "../../db/client";
import type { Project, Template, TemplateVersion } from "../../db/schema";
import { slugify } from "../projects/slug";
import { templatesRepository as repo } from "./templates.repository";
import { validateData } from "./validate-data";

type Actor = { id: string };

const MAX_SLUG_ATTEMPTS = 20;

const err = (code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST", message: string) =>
  new TRPCError({ code, message });

const noDraft = () => err("CONFLICT", "Qoralama yo'q. Avval tahrirlashni boshlang");

/** Placeholder for M3: compile the version with Typst (dry-run) and throw on errors/warnings. */
export async function publishChecks(_version: TemplateVersion): Promise<void> {}

async function uniqueSlug(projectId: string, name: string) {
  const base = slugify(name);
  for (let i = 1; i <= MAX_SLUG_ATTEMPTS; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (!(await repo.slugExists(projectId, candidate))) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

const checksumOf = (v: TemplateVersion) =>
  createHash("sha256")
    .update(JSON.stringify([v.source, v.schema, v.renderTimeoutSec, v.maxPayloadKb]))
    .digest("hex");

function describeErrors(errors: { path: string; message: string }[]) {
  return errors
    .slice(0, 3)
    .map((e) => `${e.path || "/"}: ${e.message}`)
    .join("; ");
}

export const templatesService = {
  async list(project: Project) {
    const templates = await repo.listByProject(project.id);
    const versions = await repo.versionSummaries(templates.map((t) => t.id));
    return templates.map((t) => {
      const mine = versions.filter((v) => v.templateId === t.id);
      return {
        ...t,
        currentNumber: mine.find((v) => v.id === t.currentVersionId)?.number ?? null,
        hasDraft: mine.some((v) => v.status === "draft"),
      };
    });
  },

  async create(project: Project, input: { name: string; description?: string }) {
    const slug = await uniqueSlug(project.id, input.name);
    return db.transaction(async (tx) => {
      const tpl = await repo.insertTemplate(
        {
          id: crypto.randomUUID(),
          projectId: project.id,
          slug,
          name: input.name,
          description: input.description || null,
        },
        tx,
      );
      await repo.insertVersion(
        {
          id: crypto.randomUUID(),
          templateId: tpl.id,
          number: 1,
          status: "draft",
          source: DEFAULT_TEMPLATE_SOURCE,
          schema: { fields: [] },
          sampleData: {},
        },
        tx,
      );
      return tpl;
    });
  },

  async get(template: Template) {
    const versions = await repo.versionSummaries([template.id]);
    return {
      template,
      current: versions.find((v) => v.id === template.currentVersionId) ?? null,
      draft: versions.find((v) => v.status === "draft") ?? null,
    };
  },

  findDraft: (template: Template) => repo.findDraft(template.id),

  /** Existing draft, or a new one copied from the current published version. */
  async getDraft(template: Template): Promise<TemplateVersion> {
    const existing = await repo.findDraft(template.id);
    if (existing) return existing;
    const current = await repo.findCurrent(template.id);
    if (!current) throw noDraft();
    return repo.insertVersion({
      id: crypto.randomUUID(),
      templateId: template.id,
      number: await repo.nextNumber(template.id),
      status: "draft",
      source: current.source,
      schema: current.schema,
      sampleData: current.sampleData,
      renderTimeoutSec: current.renderTimeoutSec,
      maxPayloadKb: current.maxPayloadKb,
    });
  },

  async saveDraft(template: Template, input: SaveDraftInput): Promise<TemplateVersion> {
    const draft = await repo.findDraft(template.id);
    if (!draft) throw noDraft();
    if (Buffer.byteLength(input.source) > TEMPLATE_SOURCE_MAX_BYTES) {
      throw err("BAD_REQUEST", "Kod juda katta");
    }
    // Sample data is only enforced at publish time, so the builder can be edited freely.
    return repo.updateVersion(draft.id, {
      source: input.source,
      schema: input.schema,
      sampleData: input.sampleData,
      renderTimeoutSec: input.renderTimeoutSec,
      maxPayloadKb: input.maxPayloadKb,
    });
  },

  async publish(
    actor: Actor,
    template: Template,
    opts: { acknowledgeBreaking?: boolean },
  ): Promise<{ version: TemplateVersion; breaking: BreakingChange[] }> {
    const draft = await repo.findDraft(template.id);
    if (!draft) throw noDraft();

    const parsed = templateSchemaSchema.safeParse(draft.schema);
    if (!parsed.success) throw err("BAD_REQUEST", "Schema noto'g'ri");
    const sample = validateData(parsed.data, draft.sampleData);
    if (!sample.ok) {
      throw err(
        "BAD_REQUEST",
        `Namuna ma'lumot schemaga mos emas (${describeErrors(sample.errors)})`,
      );
    }

    const current = await repo.findCurrent(template.id);
    const breaking = current ? diffSchemas(current.schema, parsed.data) : [];
    if (breaking.length > 0 && !opts.acknowledgeBreaking) {
      throw err(
        "CONFLICT",
        `Buzuvchi o'zgarishlar: ${breaking.map((b) => `${b.path} (${b.kind})`).join(", ")}`,
      );
    }

    await publishChecks(draft);

    const version = await db.transaction(async (tx) => {
      if (current) await repo.updateVersion(current.id, { status: "archived" }, tx);
      const published = await repo.updateVersion(
        draft.id,
        {
          status: "published",
          publishedAt: new Date(),
          publishedBy: actor.id,
          checksum: checksumOf(draft),
        },
        tx,
      );
      await repo.setCurrent(template.id, published.id, tx);
      return published;
    });
    return { version, breaking };
  },

  versions: (template: Template) => repo.listVersions(template.id),

  async restoreVersion(template: Template, versionId: string): Promise<TemplateVersion> {
    const source = await repo.findVersion(versionId);
    if (!source || source.templateId !== template.id) {
      throw err("NOT_FOUND", "Versiya topilmadi");
    }
    const content = {
      source: source.source,
      schema: source.schema,
      sampleData: source.sampleData,
      renderTimeoutSec: source.renderTimeoutSec,
      maxPayloadKb: source.maxPayloadKb,
    };
    const draft = await repo.findDraft(template.id);
    if (draft) {
      if (draft.id === source.id) return draft;
      return repo.updateVersion(draft.id, content);
    }
    return repo.insertVersion({
      id: crypto.randomUUID(),
      templateId: template.id,
      number: await repo.nextNumber(template.id),
      status: "draft",
      ...content,
    });
  },

  archive: (template: Template) => repo.archiveTemplate(template.id, new Date()),
};
