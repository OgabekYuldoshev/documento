import type { TemplateSchema } from "@documento/shared";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { project } from "./projects";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(now)
    .$onUpdate(() => new Date())
    .notNull(),
};

export const VERSION_STATUSES = ["draft", "published", "archived"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const template = sqliteTable(
  "template",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    /** Latest published version (no FK: avoids a circular reference). */
    currentVersionId: text("current_version_id"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("template_project_slug_uq").on(t.projectId, t.slug)],
);

export const templateVersion = sqliteTable(
  "template_version",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    status: text("status", { enum: VERSION_STATUSES }).notNull(),
    source: text("source").notNull(),
    schema: text("schema", { mode: "json" }).$type<TemplateSchema>().notNull(),
    sampleData: text("sample_data", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    renderTimeoutSec: integer("render_timeout_sec").notNull().default(60),
    maxPayloadKb: integer("max_payload_kb").notNull().default(1024),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
    checksum: text("checksum"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("template_version_number_uq").on(t.templateId, t.number),
    // At most one draft per template.
    uniqueIndex("template_version_one_draft_uq").on(t.templateId).where(sql`${t.status} = 'draft'`),
    index("template_version_template_idx").on(t.templateId),
  ],
);

export type Template = typeof template.$inferSelect;
export type TemplateVersion = typeof templateVersion.$inferSelect;

export const templateAsset = sqliteTable(
  "template_asset",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "restrict" }),
    /** File name as referenced from Typst: `assets/<name>`. */
    name: text("name").notNull(),
    kind: text("kind", { enum: ["image", "font"] }).notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storage_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  },
  (t) => [uniqueIndex("template_asset_name_uq").on(t.templateId, t.name)],
);

export type TemplateAsset = typeof templateAsset.$inferSelect;

export const GENERATION_STATUSES = [
  "queued",
  "processing",
  "ok",
  "validation_error",
  "render_error",
  "timeout",
  "expired",
] as const;
export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** One document generation (UI test run now, API requests in M4). The input data itself is never stored. */
export const generation = sqliteTable(
  "generation",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "restrict" }),
    templateVersionId: text("template_version_id")
      .notNull()
      .references(() => templateVersion.id, { onDelete: "restrict" }),
    /** Set by the API-key module in M4. */
    /** Keys are revoked, never deleted, so no FK (keeps the migration an additive ALTER). */
    apiKeyId: text("api_key_id"),
    /** Client-supplied `Idempotency-Key` (API requests); unique per key. */
    idempotencyKey: text("idempotency_key"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    source: text("source", { enum: ["ui", "api"] }).notNull(),
    status: text("status", { enum: GENERATION_STATUSES }).notNull(),
    inputSha256: text("input_sha256").notNull(),
    /** Times a worker claimed this job; a job that keeps killing workers is given up on. */
    attempts: integer("attempts").notNull().default(0),
    errorJson: text("error_json", { mode: "json" }).$type<unknown>(),
    pdfKey: text("pdf_key"),
    bytes: integer("bytes"),
    pages: integer("pages"),
    queuedAt: integer("queued_at", { mode: "timestamp_ms" }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
    durationMs: integer("duration_ms"),
    pdfExpiresAt: integer("pdf_expires_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("generation_status_queued_idx").on(t.status, t.queuedAt),
    index("generation_project_idx").on(t.projectId, t.queuedAt),
    uniqueIndex("generation_idempotency_uq")
      .on(t.apiKeyId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

export type Generation = typeof generation.$inferSelect;

export const API_KEY_SCOPES = ["project", "templates"] as const;

/** Integration keys. Only the SHA-256 hash is stored; the full key is shown once on creation. */
export const apiKey = sqliteTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    /** First 8 hex chars of the key body; used for lookup and shown in the UI. */
    prefix: text("prefix").notNull().unique(),
    hash: text("hash").notNull(),
    scope: text("scope", { enum: API_KEY_SCOPES }).notNull(),
    allowedTemplateIds: text("allowed_template_ids", { mode: "json" }).$type<string[] | null>(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  },
  (t) => [index("api_key_project_idx").on(t.projectId)],
);

export type ApiKey = typeof apiKey.$inferSelect;

/** Short-lived images uploaded by integrators; referenced from `image` fields by id (`upl_…`). */
export const upload = sqliteTable(
  "upload",
  {
    /** Public id, e.g. `upl_3f9a…`. */
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "restrict" }),
    apiKeyId: text("api_key_id"),
    format: text("format", { enum: ["png", "jpeg", "webp", "svg"] }).notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    sha256: text("sha256").notNull(),
    width: integer("width"),
    height: integer("height"),
    storageKey: text("storage_key").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("upload_project_idx").on(t.projectId), index("upload_expires_idx").on(t.expiresAt)],
);

export type Upload = typeof upload.$inferSelect;
