import { randomUUID } from "node:crypto";
import type { SaveWebhookInput, WebhookEvent } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { env } from "../../config/env";
import type { Generation, Project, Webhook, WebhookDelivery } from "../../db/schema";
import { auditService } from "../audit/audit.service";
import { generationsRepository } from "../generations/generations.repository";
import { templatesRepository } from "../templates/templates.repository";
import { generateSecret, SIGNATURE_HEADER, sign } from "./signature";
import { httpTransport, type Transport } from "./transport";
import { assertDeliverableUrl, UrlRejected } from "./url-guard";
import { webhooksRepository as repo } from "./webhooks.repository";

/** Wait before attempt N+1 after attempt N failed: 1 min, 5 min, 30 min, 2 h, 6 h. */
export const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 6 * 3_600_000];

/** Failure details inside the payload are dropped past this size (receivers can GET the document). */
const MAX_DETAILS_BYTES = 8 * 1024;

const FAILED = new Set(["validation_error", "render_error", "timeout"]);

let transport: Transport = httpTransport;
/** Tests swap the network out. */
export const setWebhookTransport = (t: Transport) => {
  transport = t;
};

export const toPublicWebhook = (w: Webhook) => ({
  id: w.id,
  url: w.url,
  enabled: w.enabled,
  secretHint: w.secret.slice(-4),
  createdAt: w.createdAt,
  updatedAt: w.updatedAt,
});

export const toPublicDelivery = ({ payload: _payload, ...rest }: WebhookDelivery) => rest;

function checkUrl(url: string) {
  try {
    assertDeliverableUrl(url);
  } catch (error) {
    if (error instanceof UrlRejected) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    }
    throw error;
  }
}

async function buildPayload(row: Generation, event: WebhookEvent, id: string, at: Date) {
  const template = await templatesRepository.findTemplate(row.templateId);
  const version = await templatesRepository.findVersion(row.templateVersionId);
  const failed = event === "document.failed";
  let error: { kind: string; details?: unknown } | undefined;
  if (failed) {
    error = { kind: row.status, details: row.errorJson };
    if (Buffer.byteLength(JSON.stringify(error)) > MAX_DETAILS_BYTES) error = { kind: row.status };
  }
  return JSON.stringify({
    id,
    type: event,
    createdAt: at.toISOString(),
    data: {
      documentId: row.id,
      status: failed ? "failed" : "ok",
      template: template
        ? { id: template.id, slug: template.slug, name: template.name }
        : { id: row.templateId },
      version: version?.number ?? null,
      pages: row.pages,
      bytes: row.bytes,
      expiresAt: row.pdfExpiresAt?.toISOString() ?? null,
      // Relative to the API origin; fetch with the same API key.
      links: {
        self: `/v1/documents/${row.id}`,
        ...(failed ? {} : { file: `/v1/documents/${row.id}/file` }),
      },
      ...(error ? { error } : {}),
    },
  });
}

/** One HTTP attempt for a claimed delivery; records the outcome and schedules a retry if due. */
async function attempt(delivery: WebhookDelivery): Promise<WebhookDelivery> {
  const hook = await repo.findById(delivery.webhookId);
  const isPing = delivery.event === "ping";
  if (!hook || (!hook.enabled && !isPing)) {
    await repo.finish(delivery.id, {
      status: "failed",
      nextAttemptAt: null,
      lastError: "Webhook o'chirilgan yoki yoqilmagan",
    });
    return { ...delivery, status: "failed" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const result = await transport(hook.url, delivery.payload, {
    "content-type": "application/json",
    "user-agent": "Documento-Webhook/1",
    "x-documento-event": delivery.event,
    "x-documento-delivery": delivery.id,
    [SIGNATURE_HEADER]: sign(hook.secret, delivery.payload, timestamp),
  });

  const base = {
    lastStatusCode: result.statusCode,
    lastError: result.error,
    durationMs: result.durationMs,
  };
  if (!result.error) {
    const patch = {
      ...base,
      status: "success" as const,
      nextAttemptAt: null,
      deliveredAt: new Date(),
    };
    await repo.finish(delivery.id, patch);
    return { ...delivery, ...patch };
  }
  const exhausted = isPing || delivery.attempts >= env.WEBHOOK_MAX_ATTEMPTS;
  const delay = RETRY_DELAYS_MS[Math.min(delivery.attempts, RETRY_DELAYS_MS.length) - 1] ?? 0;
  const patch = exhausted
    ? { ...base, status: "failed" as const, nextAttemptAt: null }
    : { ...base, status: "pending" as const, nextAttemptAt: new Date(Date.now() + delay) };
  await repo.finish(delivery.id, patch);
  return { ...delivery, ...patch };
}

export const webhooksService = {
  async get(project: Project) {
    const hook = await repo.findByProject(project.id);
    return hook ? toPublicWebhook(hook) : null;
  },

  /** Creates or updates the project's webhook. The secret is returned only on creation. */
  async save(actorId: string, project: Project, input: SaveWebhookInput) {
    checkUrl(input.url);
    const existing = await repo.findByProject(project.id);
    let secret: string | null = null;
    let hook: Webhook | null;
    if (existing) {
      hook = await repo.update(existing.id, { url: input.url, enabled: input.enabled });
    } else {
      secret = generateSecret();
      hook = await repo.insert({
        id: randomUUID(),
        projectId: project.id,
        url: input.url,
        secret,
        enabled: input.enabled,
      });
    }
    if (!hook) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook topilmadi" });
    await auditService.record({
      action: "webhook.updated",
      actorId,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      detail: `${input.enabled ? "Yoqilgan" : "O'chirilgan"}: ${input.url}`,
    });
    return { webhook: toPublicWebhook(hook), secret };
  },

  async rotateSecret(actorId: string, project: Project) {
    const existing = await repo.findByProject(project.id);
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Avval webhook sozlang" });
    const secret = generateSecret();
    const hook = await repo.update(existing.id, { secret });
    if (!hook) throw new TRPCError({ code: "NOT_FOUND", message: "Webhook topilmadi" });
    await auditService.record({
      action: "webhook.secret_rotated",
      actorId,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
    });
    return { webhook: toPublicWebhook(hook), secret };
  },

  async deliveries(project: Project, status: string | undefined, limit: number) {
    return (await repo.listDeliveries(project.id, status, limit)).map(toPublicDelivery);
  },

  /** Queues the event for a finished API generation. Never throws: it must not break the queue. */
  async enqueueForGeneration(generationId: string): Promise<void> {
    try {
      const row = await generationsRepository.find(generationId);
      if (row?.source !== "api") return;
      const event: WebhookEvent | null =
        row.status === "ok"
          ? "document.completed"
          : FAILED.has(row.status)
            ? "document.failed"
            : null;
      if (!event) return;
      const hook = await repo.findByProject(row.projectId);
      if (!hook?.enabled) return;
      const id = randomUUID();
      await repo.insertDelivery({
        id,
        webhookId: hook.id,
        projectId: row.projectId,
        generationId: row.id,
        event,
        payload: await buildPayload(row, event, id, new Date()),
        status: "pending",
        nextAttemptAt: new Date(),
      });
      kickWebhooks();
    } catch (error) {
      console.error("[webhooks] enqueue failed", generationId, error);
    }
  },

  /** Sends a `ping` right now (no retries) and returns the logged result. */
  async sendPing(project: Project) {
    const hook = await repo.findByProject(project.id);
    if (!hook) throw new TRPCError({ code: "NOT_FOUND", message: "Avval webhook sozlang" });
    checkUrl(hook.url);
    const id = randomUUID();
    const inserted = await repo.insertDelivery({
      id,
      webhookId: hook.id,
      projectId: project.id,
      event: "ping",
      payload: JSON.stringify({
        id,
        type: "ping",
        createdAt: new Date().toISOString(),
        data: { message: "Documento webhook sinovi" },
      }),
      status: "sending",
      attempts: 1,
      nextAttemptAt: new Date(),
    });
    return toPublicDelivery(await attempt(inserted));
  },

  /** Manual redelivery of a failed delivery (attempt counter restarts). */
  async retry(project: Project, deliveryId: string) {
    const row = await repo.findDelivery(project.id, deliveryId);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Yuborish topilmadi" });
    if (row.status !== "failed" || row.event === "ping") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Faqat muvaffaqiyatsiz yuborishni qayta yuborish mumkin",
      });
    }
    await repo.finish(row.id, { status: "pending", attempts: 0, nextAttemptAt: new Date() });
    kickWebhooks();
  },

  async cleanLog(now = new Date()) {
    return repo.deleteFinishedBefore(
      new Date(now.getTime() - env.WEBHOOK_LOG_RETENTION_DAYS * 86_400_000),
    );
  },
};

// ---------- worker ----------

const CONCURRENCY = 5;
const TICK_MS = 5_000;
const STUCK_AFTER_MS = 5 * 60_000;
let inFlight = 0;

/** Claims due deliveries while there is capacity. */
export async function processDue(now = new Date()): Promise<number> {
  let started = 0;
  const free = CONCURRENCY - inFlight;
  if (free <= 0) return 0;
  for (const { id } of await repo.due(now, free)) {
    const claimed = await repo.claim(id);
    if (!claimed) continue;
    inFlight++;
    started++;
    void attempt(claimed)
      .catch((e) => console.error("[webhooks] delivery crashed", id, e))
      .finally(() => {
        inFlight--;
      });
  }
  return started;
}

/** Runs one delivery attempt to completion (tests drive the worker through this). */
export async function drainWebhooks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const claimed = await repo.due(new Date(), CONCURRENCY);
    if (claimed.length === 0 && inFlight === 0) return;
    await processDue();
    await new Promise((r) => setTimeout(r, 10));
  }
}

export const kickWebhooks = () => {
  void processDue().catch((e) => console.error("[webhooks] tick failed", e));
};

/** Boot hook: retry loop, crash recovery and log pruning. */
export function startWebhookWorker() {
  const tick = async () => {
    try {
      const released = await repo.releaseStuck(new Date(Date.now() - STUCK_AFTER_MS));
      if (released > 0) console.log(`[webhooks] released ${released} stuck delivery(ies)`);
      await processDue();
    } catch (error) {
      console.error("[webhooks] tick failed", error);
    }
  };
  void tick();
  setInterval(tick, TICK_MS).unref();
  const clean = () =>
    webhooksService.cleanLog().catch((e) => console.error("[webhooks] log cleanup failed", e));
  void clean();
  setInterval(clean, 3_600_000).unref();
}
