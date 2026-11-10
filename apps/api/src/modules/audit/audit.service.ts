import { randomUUID } from "node:crypto";
import type { AuditAction, ListAuditInput } from "@documento/shared";
import { and, desc, eq, like, lt, or } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db/client";
import { auditLog, user } from "../../db/schema";

export type AuditEntry = {
  action: AuditAction;
  actorId?: string | null;
  actorLabel?: string | null;
  targetType?: "user" | "project" | "api_key" | null;
  targetId?: string | null;
  targetLabel?: string | null;
  detail?: string | null;
  ip?: string | null;
};

const clip = (value: string | null | undefined, max = 300) => (value ? value.slice(0, max) : null);

export const auditService = {
  /**
   * Append one row. Auditing must never break the action it describes, so failures are logged
   * and swallowed.
   */
  async record(entry: AuditEntry) {
    try {
      let actorLabel = entry.actorLabel ?? null;
      if (!actorLabel && entry.actorId) {
        const [row] = await db
          .select({ name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, entry.actorId))
          .limit(1);
        if (row) actorLabel = `${row.name} <${row.email}>`;
      }
      await db.insert(auditLog).values({
        id: randomUUID(),
        action: entry.action,
        actorId: entry.actorId ?? null,
        actorLabel: clip(actorLabel, 200),
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        targetLabel: clip(entry.targetLabel, 200),
        detail: clip(entry.detail),
        ip: clip(entry.ip, 64),
      });
    } catch (error) {
      console.error("audit: failed to record", entry.action, error);
    }
  },

  /** Deletes rows older than the retention window; returns how many went. */
  async cleanOld(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - env.AUDIT_RETENTION_DAYS * 86_400_000);
    const rows = await db
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .returning({ id: auditLog.id });
    return rows.length;
  },

  list(input: ListAuditInput) {
    const filters = [];
    if (input.action) filters.push(eq(auditLog.action, input.action));
    if (input.search) {
      const term = `%${input.search.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      filters.push(
        or(
          like(auditLog.actorLabel, term),
          like(auditLog.targetLabel, term),
          like(auditLog.detail, term),
        ),
      );
    }
    return db
      .select()
      .from(auditLog)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(input.limit);
  },
};

/** Boot hook: prune once at start, then hourly. */
export function startAuditCleaner() {
  const run = () =>
    auditService
      .cleanOld()
      .then((n) => n > 0 && console.log(`[audit] pruned ${n} old row(s)`))
      .catch((e) => console.error("[audit] cleanup failed", e));
  void run();
  setInterval(run, 3_600_000).unref();
}
