import { type TemplateSchema, templateSchemaSchema, toJsonSchema } from "@documento/shared";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { env } from "../../config/env";
import type { ApiKey, Generation, Project } from "../../db/schema";
import { apiKeysService } from "../api-keys/api-keys.service";
import { generationsRepository } from "../generations/generations.repository";
import { generationsService } from "../generations/generations.service";
import { pdfAvailability, streamPdf } from "../generations/pdf-response";
import { templatesRepository } from "../templates/templates.repository";
import { buildOpenApi } from "./openapi";
import { problem } from "./problem";
import { rateLimiter } from "./rate-limit";

type Vars = { key: ApiKey; project: Project };

/** Hard ceiling for any request body; the per-template `maxPayloadKb` is checked after it. */
const HARD_BODY_LIMIT = 11 * 1024 * 1024;

export const v1 = new Hono<{ Variables: Vars }>();

function extractKey(headers: Headers): string | null {
  const bearer = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization") ?? "");
  return bearer?.[1] ?? headers.get("x-api-key");
}

// Authentication + rate limit for everything under /v1.
v1.use("*", async (c, next) => {
  const auth = await apiKeysService.authenticate(extractKey(c.req.raw.headers));
  if (!auth.ok) {
    return problem(
      c,
      401,
      "invalid_api_key",
      auth.reason === "missing"
        ? "API key yuborilmagan"
        : "API key noto'g'ri, bekor qilingan yoki muddati o'tgan",
      {},
      { "WWW-Authenticate": 'Bearer realm="documento"' },
    );
  }
  const decision = rateLimiter.consume(auth.key.id, auth.key.rateLimitPerMin);
  c.header("RateLimit-Limit", String(decision.limit));
  c.header("RateLimit-Remaining", String(decision.remaining));
  if (!decision.ok) {
    return problem(
      c,
      429,
      "rate_limited",
      "So'rovlar limiti oshdi",
      {},
      { "Retry-After": String(decision.retryAfterSec) },
    );
  }
  c.set("key", auth.key);
  c.set("project", auth.project);
  await next();
});

// ---------- helpers ----------

async function currentSchema(currentVersionId: string | null) {
  if (!currentVersionId) return null;
  const version = await templatesRepository.findVersion(currentVersionId);
  if (!version) return null;
  return { version, schema: templateSchemaSchema.parse(version.schema) as TemplateSchema };
}

async function visibleTemplates(key: ApiKey, projectId: string) {
  const all = await templatesRepository.listByProject(projectId);
  return all.filter((t) => apiKeysService.canUseTemplate(key, t.id));
}

async function templateView(t: Awaited<ReturnType<typeof visibleTemplates>>[number]) {
  const current = await currentSchema(t.currentVersionId);
  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    version: current?.version.number ?? null,
    schema: current ? toJsonSchema(current.schema) : null,
  };
}

const failedStatuses = new Set(["validation_error", "render_error", "timeout"]);

function documentView(row: Generation) {
  const expired =
    row.status === "expired" ||
    (row.status === "ok" && row.pdfExpiresAt && row.pdfExpiresAt < new Date());
  const status = expired
    ? "expired"
    : failedStatuses.has(row.status)
      ? "failed"
      : row.status === "ok"
        ? "ok"
        : row.status;
  return {
    id: row.id,
    status,
    error: status === "failed" ? { kind: row.status, details: row.errorJson } : undefined,
    pages: row.pages,
    bytes: row.bytes,
    expiresAt: row.pdfExpiresAt,
    url: status === "ok" ? `/v1/documents/${row.id}/file` : undefined,
  };
}

// ---------- templates ----------

v1.get("/templates", async (c) => {
  const templates = await visibleTemplates(c.get("key"), c.get("project").id);
  return c.json({ data: await Promise.all(templates.map(templateView)) });
});

v1.get("/templates/:slug", async (c) => {
  const template = await templatesRepository.findBySlug(c.get("project").id, c.req.param("slug"));
  if (!template || template.archivedAt) return problem(c, 404, "template_not_found");
  if (!apiKeysService.canUseTemplate(c.get("key"), template.id)) {
    return problem(c, 403, "forbidden", "Bu key ushbu shablonga ruxsat bermaydi");
  }
  return c.json(await templateView(template));
});

v1.post(
  "/templates/:slug/generate",
  bodyLimit({
    maxSize: HARD_BODY_LIMIT,
    onError: (c) => problem(c, 413, "payload_too_large", "So'rov hajmi juda katta"),
  }),
  async (c) => {
    const key = c.get("key");
    const project = c.get("project");
    const template = await templatesRepository.findBySlug(project.id, c.req.param("slug"));
    if (!template || template.archivedAt) return problem(c, 404, "template_not_found");
    if (!apiKeysService.canUseTemplate(key, template.id)) {
      return problem(c, 403, "forbidden", "Bu key ushbu shablonga ruxsat bermaydi");
    }

    const current = await currentSchema(template.currentVersionId);
    if (!current)
      return problem(c, 409, "template_not_published", "Shablon hali publish qilinmagan");

    const raw = await c.req.text();
    if (Buffer.byteLength(raw) > current.version.maxPayloadKb * 1024) {
      return problem(
        c,
        413,
        "payload_too_large",
        `Ma'lumot ${current.version.maxPayloadKb} KB dan oshmasin`,
      );
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return problem(c, 400, "invalid_json", "Tana to'g'ri JSON emas");
    }
    const request = body as { data?: unknown; options?: { version?: unknown } } | null;
    if (
      typeof request !== "object" ||
      request === null ||
      typeof request.data !== "object" ||
      request.data === null ||
      Array.isArray(request.data)
    ) {
      return problem(c, 400, "invalid_request", "`data` obyekt bo'lishi kerak");
    }
    const requested = c.req.query("version") ?? request.options?.version;
    const versionNumber = requested === undefined ? undefined : Number(requested);
    if (versionNumber !== undefined && (!Number.isInteger(versionNumber) || versionNumber < 1)) {
      return problem(c, 400, "invalid_request", "`version` musbat butun son bo'lishi kerak");
    }

    let created: Awaited<ReturnType<typeof generationsService.create>>;
    try {
      created = await generationsService.create(
        {
          source: "api",
          apiKeyId: key.id,
          idempotencyKey: c.req.header("idempotency-key") || undefined,
        },
        project,
        { templateId: template.id, data: request.data as Record<string, unknown>, versionNumber },
      );
    } catch (error) {
      if (error instanceof TRPCError) {
        const status = error.code === "CONFLICT" ? 409 : error.code === "NOT_FOUND" ? 404 : 400;
        return problem(c, status, error.code.toLowerCase(), error.message);
      }
      throw error;
    }

    const location = { Location: `/v1/documents/${created.id}` };
    if (/respond-async/i.test(c.req.header("prefer") ?? "")) {
      return c.json({ id: created.id, status: "processing" }, 202, location);
    }
    const row =
      (await generationsService.waitFor(created.id, env.SYNC_WAIT_MS)) ??
      (await generationsRepository.find(created.id));
    if (!row) return problem(c, 500, "internal_error");

    if (row.status === "queued" || row.status === "processing") {
      return c.json({ id: row.id, status: "processing" }, 202, location);
    }
    if (row.status === "validation_error") {
      const err = row.errorJson as { errors?: unknown } | null;
      return problem(c, 422, "validation_error", "Ma'lumot schemaga mos emas", {
        errors: err?.errors ?? [],
        id: row.id,
      });
    }
    if (row.status === "timeout") {
      return problem(c, 504, "render_timeout", "Render vaqt limitidan oshdi", { id: row.id });
    }
    if (row.status === "render_error") {
      return problem(c, 500, "render_error", "Hujjatni render qilib bo'lmadi", {
        id: row.id,
        details: row.errorJson,
      });
    }
    if (c.req.query("response") === "json") {
      return c.json({ ...documentView(row), status: "ok" }, 200, location);
    }
    return streamPdf(row, "attachment");
  },
);

// ---------- documents ----------

async function ownedDocument(key: ApiKey, projectId: string, id: string) {
  const row = await generationsRepository.find(id);
  if (!row || row.projectId !== projectId) return null;
  return apiKeysService.canUseTemplate(key, row.templateId) ? row : null;
}

v1.get("/documents/:id", async (c) => {
  const row = await ownedDocument(c.get("key"), c.get("project").id, c.req.param("id"));
  if (!row) return problem(c, 404, "document_not_found");
  return c.json(documentView(row));
});

v1.get("/documents/:id/file", async (c) => {
  const row = await ownedDocument(c.get("key"), c.get("project").id, c.req.param("id"));
  if (!row) return problem(c, 404, "document_not_found");
  const state = pdfAvailability(row);
  if (state === "expired") {
    return problem(c, 410, "document_expired", "PDF muddati o'tgan, qayta generatsiya qiling");
  }
  if (state === "not_ready") {
    return problem(
      c,
      409,
      "document_not_ready",
      "Hujjat hali tayyor emas yoki xatolik bilan tugagan",
    );
  }
  return streamPdf(row, "attachment");
});

// ---------- OpenAPI ----------

v1.get("/openapi.json", async (c) => {
  const templates = await visibleTemplates(c.get("key"), c.get("project").id);
  const views = await Promise.all(templates.map(templateView));
  return c.json(buildOpenApi(c.get("project").name, views));
});
