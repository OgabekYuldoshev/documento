import { randomUUID } from "node:crypto";
import type { AuditAction, ListAuditInput } from "@documento/shared";
import { and, desc, eq, like, or } from "drizzle-orm";
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
