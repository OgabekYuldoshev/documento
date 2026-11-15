import { boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { ts } from "./columns";
import { project } from "./projects";

/** One outgoing webhook per project. The secret is stored as-is: it is needed to sign requests. */
export const webhook = pgTable("webhook", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "restrict" }),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Webhook = typeof webhook.$inferSelect;

/** Persistent delivery queue + log. The payload is a snapshot so every retry sends the same body. */
export const webhookDelivery = pgTable(
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
    nextAttemptAt: ts("next_attempt_at"),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    durationMs: integer("duration_ms"),
    createdAt: ts("created_at").defaultNow().notNull(),
    deliveredAt: ts("delivered_at"),
  },
  (t) => [
    index("webhook_delivery_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_delivery_project_idx").on(t.projectId, t.createdAt),
  ],
);

export type WebhookDelivery = typeof webhookDelivery.$inferSelect;
