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
