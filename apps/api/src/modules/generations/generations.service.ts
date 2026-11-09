import { createHash } from "node:crypto";
import { type TemplateSchema, templateSchemaSchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import type { Generation, Project } from "../../db/schema";
import { projectsService } from "../projects/projects.service";
import { storage } from "../storage/storage";
import { templatesRepository } from "../templates/templates.repository";
import { validateData } from "../templates/validate-data";
import { uploadsService } from "../uploads/uploads.service";
import { generationsRepository as repo } from "./generations.repository";
import { jobKey, kick } from "./queue";

type Actor = { id: string; role: Parameters<typeof projectsService.get>[0]["role"] };

/** Who asked for the document: a signed-in user (UI) or an API key (+ optional idempotency key). */
export type Origin =
  | { source: "ui"; userId: string }
  | { source: "api"; apiKeyId: string; idempotencyKey?: string };

const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

/** The pdf key is internal; clients use the download route. */
export const toPublicGeneration = ({ pdfKey: _key, ...rest }: Generation) => rest;

function sameRequest(prior: Generation, input: { templateId: string; data: unknown }) {
  const sha = createHash("sha256").update(JSON.stringify(input.data)).digest("hex");
  if (prior.templateId !== input.templateId || prior.inputSha256 !== sha) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Idempotency-Key boshqa so'rov bilan allaqachon ishlatilgan",
    });
  }
  return prior;
}

type Full = Parameters<typeof repo.insert>[0];
type Base = Omit<Full, "status">;
type Rest = Pick<Full, "status"> & Partial<Full>;

/** Insert; if a concurrent request with the same idempotency key won, return its row instead. */
async function insertOrReplay(base: Base, rest: Rest): Promise<Generation> {
  try {
    return await repo.insert({ ...base, ...rest });
  } catch (error) {
    const unique = String((error as Error).cause ?? error).includes("UNIQUE");
    if (unique && base.apiKeyId && base.idempotencyKey) {
      const prior = await repo.findByIdempotency(base.apiKeyId, base.idempotencyKey);
      if (prior) return prior;
    }
    throw error;
  }
}

export const generationsService = {
  async create(
    origin: Origin,
    project: Project,
    input: { templateId: string; data: Record<string, unknown>; versionNumber?: number },
  ) {
    if (origin.source === "api" && origin.idempotencyKey) {
      const prior = await repo.findByIdempotency(origin.apiKeyId, origin.idempotencyKey);
      if (prior) return toPublicGeneration(sameRequest(prior, input));
    }
    const template = await templatesRepository.findTemplate(input.templateId);
    if (!template || template.projectId !== project.id || template.archivedAt) {
      throw notFound("Shablon topilmadi");
    }
    const version = input.versionNumber
      ? (await templatesRepository.listVersionsFull(template.id)).find(
          (v) => v.number === input.versionNumber && v.status !== "draft",
        )
      : await templatesRepository.findCurrent(template.id);
    if (!version) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Shablon hali publish qilinmagan yoki versiya topilmadi",
      });
    }

    const base = {
      id: crypto.randomUUID(),
      projectId: project.id,
      templateId: template.id,
      templateVersionId: version.id,
      createdBy: origin.source === "ui" ? origin.userId : null,
      source: origin.source,
      apiKeyId: origin.source === "api" ? origin.apiKeyId : null,
      idempotencyKey: origin.source === "api" ? (origin.idempotencyKey ?? null) : null,
      inputSha256: createHash("sha256").update(JSON.stringify(input.data)).digest("hex"),
      queuedAt: new Date(),
    };

    const schema: TemplateSchema = templateSchemaSchema.parse(version.schema);
    const checked = validateData(schema, input.data, {
      maxPayloadBytes: version.maxPayloadKb * 1024,
    });
    const images = checked.ok
      ? await uploadsService.resolveImages(project.id, schema, checked.data, { extend: true })
      : null;
    const failed = !checked.ok ? checked.errors : images && !images.ok ? images.errors : null;
    if (!checked.ok || failed) {
      const now = new Date();
      const row = await insertOrReplay(base, {
        status: "validation_error",
        errorJson: { ok: false, kind: "validation", errors: failed ?? [] },
        finishedAt: now,
        durationMs: 0,
      });
      return toPublicGeneration(row);
    }

    await storage.put(jobKey(base.id), Buffer.from(JSON.stringify(checked.data)));
    const row = await insertOrReplay(base, { status: "queued" });
    if (row.id === base.id) kick();
    else await storage.remove(jobKey(base.id)); // lost an idempotency race: drop our copy
    return toPublicGeneration(row);
  },

  async get(actor: Actor, id: string) {
    const row = await repo.find(id);
    if (!row) throw notFound("Generatsiya topilmadi");
    await projectsService.get(actor, row.projectId);
    return row;
  },

  async list(project: Project, filter: { templateId?: string; status?: Generation["status"] }) {
    return (await repo.list({ projectId: project.id, ...filter })).map(toPublicGeneration);
  },

  /** Polls until the job leaves queued/processing or `ms` passes (sync-wait for the API). */
  async waitFor(id: string, ms: number): Promise<Generation | null> {
    const deadline = Date.now() + ms;
    for (;;) {
      const row = await repo.find(id);
      if (!row) return null;
      if (row.status !== "queued" && row.status !== "processing") return row;
      if (Date.now() >= deadline) return row;
      await new Promise((r) => setTimeout(r, 100));
    }
  },
};
