import type { TemplateSchema } from "@documento/shared";
import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { ts } from "./columns";
import { project } from "./projects";

const timestamps = {
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const VERSION_STATUSES = ["draft", "published", "archived"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const template = pgTable(
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
    archivedAt: ts("archived_at"),
    ...timestamps,
  },
  (t) => [uniqueIndex("template_project_slug_uq").on(t.projectId, t.slug)],
);

export const templateVersion = pgTable(
  "template_version",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => template.id, { onDelete: "restrict" }),
    number: integer("number").notNull(),
    status: text("status", { enum: VERSION_STATUSES }).notNull(),
    source: text("source").notNull(),
    schema: jsonb("schema").$type<TemplateSchema>().notNull(),
    sampleData: jsonb("sample_data").$type<Record<string, unknown>>().notNull(),
    renderTimeoutSec: integer("render_timeout_sec").notNull().default(60),
    maxPayloadKb: integer("max_payload_kb").notNull().default(1024),
    publishedAt: ts("published_at"),
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

export const templateAsset = pgTable(
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
    createdAt: ts("created_at").defaultNow().notNull(),
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
export const generation = pgTable(
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
    errorJson: jsonb("error_json").$type<unknown>(),
    pdfKey: text("pdf_key"),
    bytes: integer("bytes"),
    pages: integer("pages"),
    queuedAt: ts("queued_at").notNull(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    durationMs: integer("duration_ms"),
    pdfExpiresAt: ts("pdf_expires_at"),
  },
  (t) => [
    index("generation_status_queued_idx").on(t.status, t.queuedAt),
    index("generation_project_idx").on(t.projectId, t.queuedAt),
    // Oldest waiting job of one project (queue fairness); stays tiny however long history grows.
    index("generation_queued_project_idx")
      .on(t.projectId, t.queuedAt)
      .where(sql`${t.status} = 'queued'`),
    uniqueIndex("generation_idempotency_uq")
      .on(t.apiKeyId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

export type Generation = typeof generation.$inferSelect;

export const API_KEY_SCOPES = ["project", "templates"] as const;

/** Integration keys. Only the SHA-256 hash is stored; the full key is shown once on creation. */
export const apiKey = pgTable(
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
    allowedTemplateIds: jsonb("allowed_template_ids").$type<string[] | null>(),
    rateLimitPerMin: integer("rate_limit_per_min").notNull().default(60),
    expiresAt: ts("expires_at"),
    revokedAt: ts("revoked_at"),
    lastUsedAt: ts("last_used_at"),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: ts("created_at").defaultNow().notNull(),
  },
  (t) => [index("api_key_project_idx").on(t.projectId)],
);

export type ApiKey = typeof apiKey.$inferSelect;

/** Short-lived images uploaded by integrators; referenced from `image` fields by id (`upl_…`). */
export const upload = pgTable(
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
    createdAt: ts("created_at").defaultNow().notNull(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("upload_project_idx").on(t.projectId), index("upload_expires_idx").on(t.expiresAt)],
);

export type Upload = typeof upload.$inferSelect;
