import { readFile } from "node:fs/promises";
import { templateSchemaSchema } from "@documento/shared";
import { env } from "../../config/env";
import type { Generation } from "../../db/schema";
import { assetsService } from "../assets/assets.service";
import { projectsRepository } from "../projects/projects.repository";
import { renderToFile } from "../render/render.service";
import { storage } from "../storage/storage";
import { templatesRepository } from "../templates/templates.repository";
import { uploadsService } from "../uploads/uploads.service";
import { generationsRepository as repo } from "./generations.repository";

export const jobKey = (id: string) => `jobs/${id}.json`;
export const pdfKey = (id: string) => `pdf/${id}.pdf`;

let inFlight = 0;

const DAY_MS = 24 * 60 * 60 * 1000;

async function processJob(job: Generation): Promise<void> {
  const finishedWith = async (patch: Parameters<typeof repo.update>[1]) => {
    const finishedAt = new Date();
    await repo.update(job.id, {
      finishedAt,
      durationMs: job.startedAt ? finishedAt.getTime() - job.startedAt.getTime() : null,
      ...patch,
    });
  };

  try {
    const version = await templatesRepository.findVersion(job.templateVersionId);
    const project = await projectsRepository.findById(job.projectId);
    if (!version || !project) throw new Error("job references missing rows");
    const data: unknown = JSON.parse(await readFile(storage.getPath(jobKey(job.id)), "utf8"));

    const schema = templateSchemaSchema.parse(version.schema);
    const images = await uploadsService.resolveImages(job.projectId, schema, data);
    if (!images.ok) {
      await finishedWith({
        status: "validation_error",
        errorJson: { ok: false, kind: "validation", errors: images.errors },
      });
      return;
    }

    const result = await renderToFile({
      source: version.source,
      schema,
      data,
      images: { files: images.files },
      timeoutSec: version.renderTimeoutSec,
      maxPayloadBytes: version.maxPayloadKb * 1024,
      assets: await assetsService.forRender(job.templateId),
    });

    if (!result.ok) {
      const status =
        result.kind === "validation"
          ? "validation_error"
          : result.kind === "timeout"
            ? "timeout"
            : "render_error";
      await finishedWith({ status, errorJson: result });
      return;
    }
    try {
      await storage.putFile(pdfKey(job.id), result.pdfPath);
    } finally {
      await result.dispose();
    }
    const days = project.retentionDays ?? env.PDF_RETENTION_DAYS;
    await finishedWith({
      status: "ok",
      pdfKey: pdfKey(job.id),
      bytes: result.bytes,
      pages: result.pages,
      pdfExpiresAt: new Date(Date.now() + days * DAY_MS),
    });
  } catch (error) {
    console.error("[queue] job failed", job.id, error);
    await finishedWith({
      status: "render_error",
      errorJson: {
        ok: false,
        kind: "internal",
        diagnostics: [{ severity: "error", message: "Ichki xatolik" }],
      },
    });
  } finally {
    await storage.remove(jobKey(job.id)); // input data must not outlive the job
  }
}

/** Claims queued jobs while there is capacity; the memory scheduler still gates actual renders. */
export async function pump(): Promise<void> {
  while (inFlight < env.RENDER_CONCURRENCY) {
    inFlight++;
    let job: Generation | null = null;
    try {
      job = await repo.claimNext();
    } catch (error) {
      console.error("[queue] claim failed", error);
    }
    if (!job) {
      inFlight--;
      return;
    }
    void processJob(job).finally(() => {
      inFlight--;
      void pump();
    });
  }
}

export const kick = () => {
  void pump();
};

/** Boot hook: requeue interrupted jobs and start draining. */
export async function startQueue(): Promise<number> {
  const recovered = await repo.requeueProcessing();
  if (recovered > 0) console.log(`[queue] requeued ${recovered} interrupted job(s)`);
  kick();
  return recovered;
}

export const queueStats = () => ({ inFlight });
