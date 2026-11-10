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
import { webhooksService } from "../webhooks/webhooks.service";
import { generationsRepository as repo } from "./generations.repository";

export const jobKey = (id: string) => `jobs/${id}.json`;
export const pdfKey = (id: string) => `pdf/${id}.pdf`;

let inFlight = 0;
/** Jobs this process is working on right now (the watchdog must not touch them). */
const running = new Set<string>();

const DAY_MS = 24 * 60 * 60 * 1000;

async function processJob(job: Generation): Promise<void> {
  const finishedWith = async (patch: Parameters<typeof repo.update>[1]) => {
    const finishedAt = new Date();
    await repo.update(job.id, {
      finishedAt,
      durationMs: job.startedAt ? finishedAt.getTime() - job.startedAt.getTime() : null,
      ...patch,
    });
    // After the row holds its final status; failure-safe and a no-op for UI runs.
    await webhooksService.enqueueForGeneration(job.id);
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
      await finishedWith({
        status,
        errorJson: result,
        ...("durationMs" in result && result.durationMs !== undefined
          ? { durationMs: result.durationMs }
          : {}),
      });
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
      durationMs: result.durationMs,
      pdfExpiresAt: new Date(Date.now() + days * DAY_MS),
    });
  } catch (error) {
    console.error("[queue] job failed", job.id, error);
    // If even this write fails the row stays `processing` and the watchdog recovers it.
    await finishedWith({
      status: "render_error",
      errorJson: {
        ok: false,
        kind: "internal",
        diagnostics: [{ severity: "error", message: "Ichki xatolik" }],
      },
    }).catch((e) => console.error("[queue] could not record failure", job.id, e));
  } finally {
    await removeJobFile(job.id);
  }
}

/** Input data must not outlive the job. */
const removeJobFile = (id: string) =>
  storage.remove(jobKey(id)).catch((e) => console.error("[queue] job file cleanup failed", id, e));

/** Runs one job; never rejects, so a bad job cannot take the process down. */
async function runJob(job: Generation): Promise<void> {
  running.add(job.id);
  try {
    await processJob(job);
  } catch (error) {
    console.error("[queue] unexpected job error", job.id, error);
  } finally {
    running.delete(job.id);
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
    void runJob(job).finally(() => {
      inFlight--;
      void pump();
    });
  }
}

export const kick = () => {
  void pump();
};

async function recover(opts: { startedBefore?: Date; skip?: string[] }) {
  const { requeued, abandoned } = await repo.recoverStalled({
    maxAttempts: env.JOB_MAX_ATTEMPTS,
    ...opts,
  });
  await Promise.all(abandoned.map(removeJobFile));
  await Promise.all(abandoned.map((id) => webhooksService.enqueueForGeneration(id)));
  if (requeued.length > 0) console.log(`[queue] requeued ${requeued.length} stalled job(s)`);
  if (abandoned.length > 0) console.warn(`[queue] gave up on ${abandoned.length} failing job(s)`);
  if (requeued.length > 0) kick();
  return requeued.length;
}

/** Boot hook: requeue interrupted jobs, start draining and watch for stuck ones. */
export async function startQueue(): Promise<number> {
  const recovered = await recover({});
  kick();
  setInterval(() => {
    const startedBefore = new Date(Date.now() - env.JOB_STALE_MINUTES * 60_000);
    recover({ startedBefore, skip: [...running] }).catch((e) =>
      console.error("[queue] watchdog failed", e),
    );
  }, 60_000).unref();
  return recovered;
}

export const queueStats = () => ({ inFlight });
