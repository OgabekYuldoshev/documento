import { index, pgTable, text } from "drizzle-orm/pg-core";
import { ts } from "./columns";

/**
 * Append-only trail of sensitive actions. No foreign keys on purpose: rows must outlive the
 * users/projects they describe, so names are stored as snapshots.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    createdAt: ts("created_at").defaultNow().notNull(),
    actorId: text("actor_id"),
    /** Name/email of the actor at the time (or the attempted email for failed sign-ins). */
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    detail: text("detail"),
    ip: text("ip"),
  },
  (t) => [
    index("audit_log_created_at_idx").on(t.createdAt),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_actor_idx").on(t.actorId),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
