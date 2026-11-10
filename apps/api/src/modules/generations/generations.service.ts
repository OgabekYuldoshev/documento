import { createHash } from "node:crypto";
import { type TemplateSchema, templateSchemaSchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import type { Generation, Project } from "../../db/schema";
import { canonicalJson } from "../../lib/canonical-json";
import { projectsService } from "../projects/projects.service";
import { storage } from "../storage/storage";
import { templatesRepository } from "../templates/templates.repository";
import { validateData } from "../templates/validate-data";
import { uploadsService } from "../uploads/uploads.service";
import { generationsRepository as repo } from "./generations.repository";
import { waitForJobSignal } from "./job-events";
import { jobKey, kick } from "./queue";

/** Safety-net re-check interval for sync waiters; the queue normally wakes them at once. */
const RECHECK_MS = 1000;

type Actor = { id: string; role: Parameters<typeof projectsService.get>[0]["role"] };

/** Who asked for the document: a signed-in user (UI) or an API key (+ optional idempotency key). */
export type Origin =
  | { source: "ui"; userId: string }
  | { source: "api"; apiKeyId: string; idempotencyKey?: string };

const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

/** The pdf key is internal; clients use the download route. */
export const toPublicGeneration = ({ pdfKey: _key, ...rest }: Generation) => rest;

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** Hash of the input; key order does not matter. */
const hashOf = (data: unknown) => sha256(canonicalJson(data));

/**
 * The same key must come with the same request: template, data (key order ignored) and, when
 * pinned, version. Rows written before canonical hashing used plain `JSON.stringify`: accepted too.
 */
async function sameRequest(
  prior: Generation,
  input: { templateId: string; data: unknown; versionNumber?: number },
) {
  const sameData =
    prior.inputSha256 === hashOf(input.data) ||
    prior.inputSha256 === sha256(JSON.stringify(input.data));
  let sameVersion = true;
  if (input.versionNumber !== undefined) {
    const version = await templatesRepository.findVersion(prior.templateVersionId);
    sameVersion = version?.number === input.versionNumber;
  }
  if (prior.templateId !== input.templateId || !sameData || !sameVersion) {
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
  /** Job counters across the actor's projects (running, failed and created in 24 h / 7 d). */
  activity: (actor: Actor) =>
    repo.activity(actor.role === "superadmin" ? {} : { userId: actor.id }, new Date()),

  /** Latest generations across the actor's projects, with template and project names. */
  recent: (actor: Actor, limit = 8) =>
    repo.recentWithContext(actor.role === "superadmin" ? {} : { userId: actor.id }, limit),

  async create(
    origin: Origin,
    project: Project,
    input: { templateId: string; data: Record<string, unknown>; versionNumber?: number },
  ) {
    if (origin.source === "api" && origin.idempotencyKey) {
      const prior = await repo.findByIdempotency(origin.apiKeyId, origin.idempotencyKey);
      if (prior) {
        const expiresAt = prior.queuedAt.getTime() + env.IDEMPOTENCY_TTL_HOURS * 3_600_000;
        // Past the window the key is free again; the old row stays as history without it.
        if (expiresAt > Date.now()) return toPublicGeneration(await sameRequest(prior, input));
        await repo.clearIdempotency(prior.id);
      }
    }
    const template = await templatesRepository.findTemplate(input.templateId);
    if (!template || template.projectId !== project.id || template.archivedAt) {
      throw notFound("Shablon topilmadi");
    }
    const pinned = input.versionNumber
      ? await templatesRepository.findVersionByNumber(template.id, input.versionNumber)
      : null;
    const version = input.versionNumber
      ? pinned?.status === "draft"
        ? null // drafts are never rendered for real
        : pinned
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
      inputSha256: hashOf(input.data),
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

    if ((await repo.countPending(project.id)) >= env.PROJECT_MAX_PENDING) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Project navbati to'lgan. Avvalgi hujjatlar tugashini kuting",
      });
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

  /**
   * Waits until the job leaves queued/processing or `ms` passes (sync-wait for the API). The
   * queue signals completion; a slow re-check covers jobs finished without a signal (watchdog).
   */
  async waitFor(id: string, ms: number): Promise<Generation | null> {
    const deadline = Date.now() + ms;
    for (;;) {
      // Subscribe before reading so a job finishing in between is not missed.
      const signal = waitForJobSignal(id, Math.min(RECHECK_MS, Math.max(0, deadline - Date.now())));
      const row = await repo.find(id);
      if (
        !row ||
        (row.status !== "queued" && row.status !== "processing") ||
        Date.now() >= deadline
      ) {
        signal.cancel();
        return row ?? null;
      }
      await signal.promise;
    }
  },

  /**
   * Retention: deletes PDFs past their expiry and marks the rows `expired` (the row stays as
   * history). Returns how many were cleaned.
   */
  async cleanExpired(now = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await repo.expiredPdfs(now);
      let cleaned = 0;
      for (const row of rows) {
        // One bad file must not block the rest; the row stays `ok` and the next sweep retries it.
        try {
          if (row.pdfKey) await storage.remove(row.pdfKey);
          await repo.update(row.id, { status: "expired", pdfKey: null });
          cleaned++;
        } catch (error) {
          console.error("[retention] could not clean", row.id, error);
        }
      }
      total += cleaned;
      // A full batch of failures would be fetched again forever: stop and wait for the next sweep.
      if (rows.length < 500 || cleaned === 0) return total;
    }
  },
};

/** Boot hook: sweep every 10 minutes (and once at start). */
export function startRetentionCleaner() {
  const run = () =>
    generationsService.cleanExpired().catch((e) => console.error("[retention] cleanup failed", e));
  void run();
  setInterval(run, 10 * 60_000).unref();
}
