import { and, asc, desc, eq, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { webhook, webhookDelivery } = schema;

export type NewDelivery = typeof webhookDelivery.$inferInsert;

export const webhooksRepository = {
  async findByProject(projectId: string) {
    const [row] = await db.select().from(webhook).where(eq(webhook.projectId, projectId)).limit(1);
    return row ?? null;
  },

  async findById(id: string) {
    const [row] = await db.select().from(webhook).where(eq(webhook.id, id)).limit(1);
    return row ?? null;
  },

  async insert(values: typeof webhook.$inferInsert) {
    const [row] = await db.insert(webhook).values(values).returning();
    if (!row) throw new Error("webhook insert returned no row");
    return row;
  },

  async update(id: string, patch: Partial<typeof webhook.$inferInsert>) {
    const [row] = await db.update(webhook).set(patch).where(eq(webhook.id, id)).returning();
    return row ?? null;
  },

  async insertDelivery(values: NewDelivery) {
    const [row] = await db.insert(webhookDelivery).values(values).returning();
    if (!row) throw new Error("delivery insert returned no row");
    return row;
  },

  async findDelivery(projectId: string, id: string) {
    const [row] = await db
      .select()
      .from(webhookDelivery)
      .where(and(eq(webhookDelivery.id, id), eq(webhookDelivery.projectId, projectId)))
      .limit(1);
    return row ?? null;
  },

  listDeliveries(projectId: string, status: string | undefined, limit: number) {
    const conds = [eq(webhookDelivery.projectId, projectId)];
    if (status) {
      conds.push(
        eq(webhookDelivery.status, status as (typeof webhookDelivery.$inferSelect)["status"]),
      );
    }
    return db
      .select()
      .from(webhookDelivery)
      .where(and(...conds))
      .orderBy(desc(webhookDelivery.createdAt))
      .limit(limit);
  },

  /** Oldest due deliveries first; claiming is a separate atomic step. */
  due: (now: Date, limit: number) =>
    db
      .select({ id: webhookDelivery.id })
      .from(webhookDelivery)
      .where(and(eq(webhookDelivery.status, "pending"), lte(webhookDelivery.nextAttemptAt, now)))
      .orderBy(asc(webhookDelivery.nextAttemptAt))
      .limit(limit),

  /** pending -> sending, counting the attempt; null when another tick already took it. */
  async claim(id: string) {
    const [row] = await db
      .select()
      .from(webhookDelivery)
      .where(and(eq(webhookDelivery.id, id), eq(webhookDelivery.status, "pending")))
      .limit(1);
    if (!row) return null;
    const [claimed] = await db
      .update(webhookDelivery)
      .set({ status: "sending", attempts: row.attempts + 1, nextAttemptAt: new Date() })
      .where(and(eq(webhookDelivery.id, id), eq(webhookDelivery.status, "pending")))
      .returning();
    return claimed ?? null;
  },

  async finish(id: string, patch: Partial<typeof webhookDelivery.$inferInsert>) {
    await db.update(webhookDelivery).set(patch).where(eq(webhookDelivery.id, id));
  },

  /** `sending` rows older than the cutoff belong to a crashed worker: make them due again. */
  async releaseStuck(before: Date) {
    const rows = await db
      .update(webhookDelivery)
      .set({ status: "pending", nextAttemptAt: new Date() })
      .where(and(eq(webhookDelivery.status, "sending"), lt(webhookDelivery.nextAttemptAt, before)))
      .returning({ id: webhookDelivery.id });
    return rows.length;
  },

  /** Only finished rows are pruned; pending/sending ones are still work. */
  async deleteFinishedBefore(before: Date) {
    const rows = await db
      .delete(webhookDelivery)
      .where(
        and(
          inArray(webhookDelivery.status, ["success", "failed"]),
          isNotNull(webhookDelivery.createdAt),
          lt(webhookDelivery.createdAt, before),
        ),
      )
      .returning({ id: webhookDelivery.id });
    return rows.length;
  },
};
