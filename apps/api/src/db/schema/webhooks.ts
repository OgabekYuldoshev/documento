import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { project } from "./projects";

const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

/** One outgoing webhook per project. The secret is stored as-is: it is needed to sign requests. */
export const webhook = sqliteTable("webhook", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "restrict" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(now)
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Webhook = typeof webhook.$inferSelect;

/** Persistent delivery queue + log. The payload is a snapshot so every retry sends the same body. */
export const webhookDelivery = sqliteTable(
  "webhook_delivery",
  {
    /** Also the event id receivers can use to deduplicate. */
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhook.id, { onDelete: "cascade" }),
    projectId: text("project_id").notNull(),
    generationId: text("generation_id"),
    event: text("event").notNull(),
    payload: text("payload").notNull(),
    status: text("status", { enum: ["pending", "sending", "success", "failed"] }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    /** Null once the delivery is finished. */
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp_ms" }),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    durationMs: integer("duration_ms"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).default(now).notNull(),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("webhook_delivery_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_delivery_project_idx").on(t.projectId, t.createdAt),
  ],
);

export type WebhookDelivery = typeof webhookDelivery.$inferSelect;
