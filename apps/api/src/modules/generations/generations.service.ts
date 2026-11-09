import { createHash } from "node:crypto";
import { type TemplateSchema, templateSchemaSchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import type { Generation, Project } from "../../db/schema";
import { projectsService } from "../projects/projects.service";
import { storage } from "../storage/storage";
import { templatesRepository } from "../templates/templates.repository";
import { validateData } from "../templates/validate-data";
import { generationsRepository as repo } from "./generations.repository";
import { jobKey, kick } from "./queue";

type Actor = { id: string; role: Parameters<typeof projectsService.get>[0]["role"] };

const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

/** The pdf key is internal; clients use the download route. */
export const toPublicGeneration = ({ pdfKey: _key, ...rest }: Generation) => rest;

export const generationsService = {
  async create(
    actor: Actor,
    project: Project,
    input: { templateId: string; data: Record<string, unknown>; versionNumber?: number },
  ) {
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
      createdBy: actor.id,
      source: "ui" as const,
      inputSha256: createHash("sha256").update(JSON.stringify(input.data)).digest("hex"),
      queuedAt: new Date(),
    };

    const schema: TemplateSchema = templateSchemaSchema.parse(version.schema);
    const checked = validateData(schema, input.data, {
      maxPayloadBytes: version.maxPayloadKb * 1024,
    });
    if (!checked.ok) {
      const now = new Date();
      const row = await repo.insert({
        ...base,
        status: "validation_error",
        errorJson: { ok: false, kind: "validation", errors: checked.errors },
        finishedAt: now,
        durationMs: 0,
      });
      return toPublicGeneration(row);
    }

    await storage.put(jobKey(base.id), Buffer.from(JSON.stringify(checked.data)));
    const row = await repo.insert({ ...base, status: "queued" });
    kick();
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
