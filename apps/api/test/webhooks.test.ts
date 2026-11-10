import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { auditService } from "../src/modules/audit/audit.service";
import { sign, verify } from "../src/modules/webhooks/signature";
import { httpTransport } from "../src/modules/webhooks/transport";
import {
  assertDeliverableUrl,
  isPublicAddress,
  UrlRejected,
} from "../src/modules/webhooks/url-guard";
import {
  drainWebhooks,
  setWebhookTransport,
  webhooksService,
} from "../src/modules/webhooks/webhooks.service";
import { callerFor, createUser } from "./factories";

const SCHEMA: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

type Sent = { url: string; body: string; headers: Record<string, string> };

function fakeNetwork(responses: { statusCode: number | null; error: string | null }[]) {
  const sent: Sent[] = [];
  setWebhookTransport(async (url, body, headers) => {
    sent.push({ url, body, headers });
    const r = responses[Math.min(sent.length, responses.length) - 1] ?? {
      statusCode: 200,
      error: null,
    };
    return { ...r, durationMs: 5 };
  });
  return sent;
}

afterEach(() => setWebhookTransport(httpTransport));

async function setup() {
  const user = await createUser();
  const owner = callerFor(user);
  const project = await owner.projects.create({ name: "Hook project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Hook tpl" });
  const ids = { projectId: project.id, templateId: tpl.id };
  await owner.templates.saveDraft({
    ...ids,
    source: "Salom",
    schema: SCHEMA,
    sampleData: { name: "Ali" },
    renderTimeoutSec: 30,
    maxPayloadKb: 64,
  });
  await owner.templates.publish(ids);
  const [version] = await db
    .select()
    .from(schema.templateVersion)
    .where(eq(schema.templateVersion.templateId, tpl.id));
  if (!version) throw new Error("no version");
  const generate = async (status: string, source: "api" | "ui" = "api") => {
    const id = crypto.randomUUID();
    await db.insert(schema.generation).values({
      id,
      projectId: project.id,
      templateId: tpl.id,
      templateVersionId: version.id,
      source,
      status: status as "ok",
      inputSha256: "x",
      queuedAt: new Date(),
      pages: 2,
      bytes: 1234,
      errorJson: status === "ok" ? null : { ok: false, kind: "render" },
    });
    return id;
  };
  return { user, owner, project, ids, generate };
}

const deliveriesOf = (projectId: string) =>
  db.select().from(schema.webhookDelivery).where(eq(schema.webhookDelivery.projectId, projectId));

describe("webhook signature", () => {
  it("verifies a good signature and rejects tampering and stale timestamps", () => {
    const body = '{"a":1}';
    const header = sign("whsec_x", body, 1_000_000);
    expect(verify("whsec_x", body, header, 300, 1_000_100)).toBe(true);
    expect(verify("whsec_x", `${body} `, header, 300, 1_000_100)).toBe(false);
    expect(verify("whsec_y", body, header, 300, 1_000_100)).toBe(false);
    expect(verify("whsec_x", body, header, 300, 1_001_000)).toBe(false);
  });
});

describe("webhook url guard", () => {
  it("classifies addresses", () => {
    for (const bad of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "0.0.0.0",
    ]) {
      expect(isPublicAddress(bad), bad).toBe(false);
    }
    for (const good of ["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isPublicAddress(good), good).toBe(true);
    }
  });

  it("rejects internal and malformed URLs", () => {
    for (const bad of [
      "http://localhost/x",
      "http://127.0.0.1:3001/x",
      "https://10.0.0.5/",
      "http://[::1]/",
      "https://user:pw@example.com/",
      "ftp://example.com/",
      "not a url",
      "http://metadata.internal/",
    ]) {
      expect(() => assertDeliverableUrl(bad), bad).toThrow(UrlRejected);
    }
    expect(assertDeliverableUrl("https://example.com/hook").hostname).toBe("example.com");
  });

  it("real transport refuses private targets", async () => {
    const r = await httpTransport("http://127.0.0.1:9/hook", "{}", {});
    expect(r.statusCode).toBeNull();
    expect(r.error).toMatch(/Ichki manzil/);
  });
});

describe("webhook config", () => {
  it("shows the secret once, keeps it on update, rotates it, owner only", async () => {
    const { owner, project } = await setup();
    const created = await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    expect(created.secret).toMatch(/^whsec_/);
    expect(created.webhook.secretHint).toBe(created.secret?.slice(-4));

    const updated = await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h2",
      enabled: false,
    });
    expect(updated.secret).toBeNull();
    expect(updated.webhook.url).toBe("https://example.com/h2");

    const rotated = await owner.webhooks.rotateSecret({ projectId: project.id });
    expect(rotated.secret).not.toBe(created.secret);
    expect(JSON.stringify(await owner.webhooks.get({ projectId: project.id }))).not.toContain(
      "whsec_",
    );

    const stranger = callerFor(await createUser());
    expect((await fail(stranger.webhooks.get({ projectId: project.id })))?.code).toBe("NOT_FOUND");
  });

  it("rejects internal URLs at save time", async () => {
    const { owner, project } = await setup();
    const error = await fail(
      owner.webhooks.save({ projectId: project.id, url: "http://127.0.0.1/x", enabled: true }),
    );
    expect(error?.code).toBe("BAD_REQUEST");
  });
});

describe("webhook delivery", () => {
  it("delivers a signed document.completed event for API generations only", async () => {
    const { owner, project, generate } = await setup();
    const { secret } = await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    const sent = fakeNetwork([{ statusCode: 200, error: null }]);

    await webhooksService.enqueueForGeneration(await generate("ok", "ui"));
    expect(await deliveriesOf(project.id)).toHaveLength(0);

    const docId = await generate("ok");
    await webhooksService.enqueueForGeneration(docId);
    await drainWebhooks();

    expect(sent).toHaveLength(1);
    const first = sent[0] as Sent;
    expect(first.url).toBe("https://example.com/h");
    expect(verify(secret ?? "", first.body, first.headers["x-documento-signature"] ?? "")).toBe(
      true,
    );
    const payload = JSON.parse(first.body);
    expect(payload).toMatchObject({
      type: "document.completed",
      data: {
        documentId: docId,
        status: "ok",
        pages: 2,
        links: { file: `/v1/documents/${docId}/file` },
      },
    });
    expect(first.headers["x-documento-delivery"]).toBe(payload.id);
    const [row] = await deliveriesOf(project.id);
    expect(row).toMatchObject({ status: "success", attempts: 1, lastStatusCode: 200 });
  });

  it("sends document.failed with the error and skips disabled webhooks", async () => {
    const { owner, project, generate } = await setup();
    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: false,
    });
    const sent = fakeNetwork([]);
    await webhooksService.enqueueForGeneration(await generate("render_error"));
    expect(await deliveriesOf(project.id)).toHaveLength(0);

    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    await webhooksService.enqueueForGeneration(await generate("render_error"));
    await drainWebhooks();
    const body = JSON.parse((sent[0] as Sent).body);
    expect(body).toMatchObject({
      type: "document.failed",
      data: { status: "failed", error: { kind: "render_error" } },
    });
    expect(body.data.links.file).toBeUndefined();
  });

  it("retries with backoff, gives up after the max attempts, and can be retried by hand", async () => {
    const { owner, project, generate } = await setup();
    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    const sent = fakeNetwork([{ statusCode: 500, error: "HTTP 500" }]);
    await webhooksService.enqueueForGeneration(await generate("ok"));
    await drainWebhooks();

    let [row] = await deliveriesOf(project.id);
    expect(row).toMatchObject({
      status: "pending",
      attempts: 1,
      lastStatusCode: 500,
      lastError: "HTTP 500",
    });
    const wait = (row?.nextAttemptAt?.getTime() ?? 0) - Date.now();
    expect(wait).toBeGreaterThan(50_000);
    expect(wait).toBeLessThanOrEqual(60_000);

    for (let i = 2; i <= env.WEBHOOK_MAX_ATTEMPTS; i++) {
      await db
        .update(schema.webhookDelivery)
        .set({ nextAttemptAt: new Date() })
        .where(eq(schema.webhookDelivery.projectId, project.id));
      await drainWebhooks();
    }
    [row] = await deliveriesOf(project.id);
    expect(row).toMatchObject({
      status: "failed",
      attempts: env.WEBHOOK_MAX_ATTEMPTS,
      nextAttemptAt: null,
    });
    expect(sent).toHaveLength(env.WEBHOOK_MAX_ATTEMPTS);

    fakeNetwork([{ statusCode: 200, error: null }]);
    await owner.webhooks.retry({ projectId: project.id, deliveryId: row?.id ?? "" });
    await drainWebhooks();
    [row] = await deliveriesOf(project.id);
    expect(row).toMatchObject({ status: "success", attempts: 1 });
    expect(
      (await fail(owner.webhooks.retry({ projectId: project.id, deliveryId: row?.id ?? "" })))
        ?.code,
    ).toBe("BAD_REQUEST");
  });

  it("ping is logged, sent once and never retried", async () => {
    const { owner, project } = await setup();
    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: false,
    });
    const sent = fakeNetwork([{ statusCode: 503, error: "HTTP 503" }]);
    const result = await owner.webhooks.test({ projectId: project.id });
    expect(result).toMatchObject({ event: "ping", status: "failed", lastStatusCode: 503 });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("payload");
  });

  it("project deletion removes the webhook and its log", async () => {
    const { owner, project, generate } = await setup();
    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    fakeNetwork([]);
    await webhooksService.enqueueForGeneration(await generate("ok"));
    await drainWebhooks();
    await owner.projects.delete({ projectId: project.id, confirmName: "Hook project" });
    expect(await deliveriesOf(project.id)).toHaveLength(0);
    expect(
      await db.select().from(schema.webhook).where(eq(schema.webhook.projectId, project.id)),
    ).toHaveLength(0);
  });
});

describe("webhook over real HTTP", () => {
  it("posts the signed body, treats 5xx and redirects as failures", async () => {
    const received: { body: string; headers: IncomingMessage["headers"] }[] = [];
    let mode: "ok" | "error" | "redirect" = "ok";
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        received.push({ body, headers: req.headers });
        if (mode === "redirect") res.writeHead(302, { location: "http://127.0.0.1:1/" });
        else res.writeHead(mode === "error" ? 500 : 204);
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/hook`;
    const mutable = env as { WEBHOOK_ALLOW_PRIVATE: string };
    const before = mutable.WEBHOOK_ALLOW_PRIVATE;
    mutable.WEBHOOK_ALLOW_PRIVATE = "on";
    try {
      const ok = await httpTransport(url, '{"x":1}', {
        "content-type": "application/json",
        "x-test": "1",
      });
      expect(ok).toMatchObject({ statusCode: 204, error: null });
      expect(received[0]?.body).toBe('{"x":1}');
      expect(received[0]?.headers["x-test"]).toBe("1");

      mode = "error";
      expect(await httpTransport(url, "{}", {})).toMatchObject({
        statusCode: 500,
        error: "HTTP 500",
      });
      mode = "redirect";
      expect((await httpTransport(url, "{}", {})).error).toMatch(/redirect/);
    } finally {
      mutable.WEBHOOK_ALLOW_PRIVATE = before;
      server.close();
    }
  });
});

describe("retention sweeps", () => {
  it("prunes audit rows older than the retention window only", async () => {
    const day = 86_400_000;
    const old = new Date(Date.now() - (env.AUDIT_RETENTION_DAYS + 1) * day);
    const recent = new Date(Date.now() - (env.AUDIT_RETENTION_DAYS - 1) * day);
    const values = (id: string, createdAt: Date) => ({ id, createdAt, action: "auth.login" });
    await db
      .insert(schema.auditLog)
      .values([values("audit-old", old), values("audit-recent", recent)]);
    expect(await auditService.cleanOld()).toBeGreaterThanOrEqual(1);
    const ids = (await db.select({ id: schema.auditLog.id }).from(schema.auditLog)).map(
      (r) => r.id,
    );
    expect(ids).not.toContain("audit-old");
    expect(ids).toContain("audit-recent");
  });

  it("prunes finished webhook deliveries but never pending ones", async () => {
    const { owner, project } = await setup();
    await owner.webhooks.save({
      projectId: project.id,
      url: "https://example.com/h",
      enabled: true,
    });
    const hook = await db
      .select()
      .from(schema.webhook)
      .where(eq(schema.webhook.projectId, project.id));
    const webhookId = hook[0]?.id ?? "";
    const old = new Date(Date.now() - (env.WEBHOOK_LOG_RETENTION_DAYS + 1) * 86_400_000);
    const row = (id: string, status: "success" | "pending") => ({
      id,
      webhookId,
      projectId: project.id,
      event: "ping",
      payload: "{}",
      status,
      createdAt: old,
      nextAttemptAt: status === "pending" ? new Date(Date.now() + 3_600_000) : null,
    });
    await db
      .insert(schema.webhookDelivery)
      .values([row("d-old-ok", "success"), row("d-old-pending", "pending")]);
    await webhooksService.cleanLog();
    const ids = (await deliveriesOf(project.id)).map((r) => r.id);
    expect(ids).not.toContain("d-old-ok");
    expect(ids).toContain("d-old-pending");
  });
});
