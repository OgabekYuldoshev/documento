import { createHash } from "node:crypto";
import {
  type BreakingChange,
  DEFAULT_TEMPLATE_JSON_SCHEMA,
  DEFAULT_TEMPLATE_SOURCE,
  diffSchemas,
  type Role,
  type SaveDraftInput,
  sampleFromSchema,
  TEMPLATE_SOURCE_MAX_BYTES,
  type TemplateSchema,
  templateSchemaSchema,
} from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import { db } from "../../db/client";
import type { Project, Template, TemplateVersion } from "../../db/schema";
import { slugify } from "../projects/slug";
import { runPublishDryRun } from "../render/render.service";
import { templatesRepository as repo } from "./templates.repository";
import { assertSchemaCompiles, SchemaDefinitionError, validateData } from "./validate-data";

type Actor = { id: string; role: Role };

const MAX_SLUG_ATTEMPTS = 20;

/** Ajv (strict) is the authority on whether the author's JSON Schema is usable. */
export function assertSchemaDefinition(schema: TemplateSchema) {
  try {
    assertSchemaCompiles(schema);
  } catch (error) {
    if (error instanceof SchemaDefinitionError) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Schema noto'g'ri: ${error.message}` });
    }
    throw error;
  }
}

const err = (code: "NOT_FOUND" | "CONFLICT" | "BAD_REQUEST", message: string) =>
  new TRPCError({ code, message });

const noDraft = () => err("CONFLICT", "Qoralama yo'q. Avval tahrirlashni boshlang");

/** Compile the version with its sample data (errors and warnings block publishing). */
export async function publishChecks(version: TemplateVersion): Promise<void> {
  if (env.PUBLISH_DRY_RUN === "off") return;
  await runPublishDryRun(version);
}

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

/** Everything a publish validates (dry-run uses the sample too), so edits during it are caught. */
const contentHashOf = (v: TemplateVersion) =>
  createHash("sha256")
    .update(JSON.stringify([v.source, v.schema, v.sampleData, v.renderTimeoutSec, v.maxPayloadKb]))
    .digest("hex");

function describeErrors(errors: { path: string; message: string }[]) {
  return errors
    .slice(0, 3)
    .map((e) => `${e.path || "/"}: ${e.message}`)
    .join("; ");
}

export const templatesService = {
  /** Most recently edited templates of the projects the actor can access (sidebar shortcut). */
  recent: (actor: Actor, limit = 3) =>
    repo.recent(actor.role === "superadmin" ? {} : { userId: actor.id }, limit),

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
          schema: DEFAULT_TEMPLATE_JSON_SCHEMA,
          sampleData: sampleFromSchema(templateSchemaSchema.parse(DEFAULT_TEMPLATE_JSON_SCHEMA)),
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

  /** Slug + example request body for the integration snippets (published version only). */
  async apiExample(template: Template) {
    const current = await repo.findCurrent(template.id);
    if (!current) return null;
    return {
      slug: template.slug,
      version: current.number,
      data: sampleFromSchema(templateSchemaSchema.parse(current.schema)),
    };
  },

  findDraft: (template: Template) => repo.findDraft(template.id),

  /** Published version content, shown read-only when there is no draft. */
  findCurrent: (template: Template) => repo.findCurrent(template.id),

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
    assertSchemaDefinition(input.schema);
    // Sample data is only enforced at publish time, so the builder can be edited freely.
    const saved = await repo.updateDraft(draft.id, {
      source: input.source,
      schema: input.schema,
      sampleData: input.sampleData,
      renderTimeoutSec: input.renderTimeoutSec,
      maxPayloadKb: input.maxPayloadKb,
    });
    if (!saved) throw noDraft(); // published while we were saving
    return saved;
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
    assertSchemaDefinition(parsed.data);
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
      // The dry-run can take a while: publish only what was actually validated.
      const fresh = await repo.findDraft(template.id, tx);
      if (!fresh || fresh.id !== draft.id || contentHashOf(fresh) !== contentHashOf(draft)) {
        throw err("CONFLICT", "Qoralama tekshiruv paytida o'zgardi. Qayta publish qiling");
      }
      // Compare against the current version again: another publish may have won meanwhile.
      const now = await repo.findCurrent(template.id, tx);
      if (now?.id !== current?.id) {
        throw err("CONFLICT", "Shablon boshqa publish bilan o'zgardi. Qayta urinib ko'ring");
      }
      if (current) await repo.updateVersion(current.id, { status: "archived" }, tx);
      const published = await repo.updateDraft(
        draft.id,
        {
          status: "published",
          publishedAt: new Date(),
          publishedBy: actor.id,
          checksum: checksumOf(draft),
        },
        tx,
      );
      if (!published) throw noDraft();
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
      const restored = await repo.updateDraft(draft.id, content);
      if (!restored) throw noDraft();
      return restored;
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
