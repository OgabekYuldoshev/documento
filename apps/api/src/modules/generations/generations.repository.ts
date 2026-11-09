import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";
import type { GenerationStatus } from "../../db/schema";

const { generation } = schema;

export type NewGeneration = typeof generation.$inferInsert;
export type GenerationPatch = Partial<Omit<NewGeneration, "id">>;

export const generationsRepository = {
  async insert(values: NewGeneration) {
    const [row] = await db.insert(generation).values(values).returning();
    if (!row) throw new Error("generation insert returned no row");
    return row;
  },

  async find(id: string) {
    const [row] = await db.select().from(generation).where(eq(generation.id, id)).limit(1);
    return row ?? null;
  },

  /** Oldest queued job, atomically flipped to `processing`; null when the queue is empty. */
  async claimNext() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const [next] = await db
        .select({ id: generation.id })
        .from(generation)
        .where(eq(generation.status, "queued"))
        .orderBy(generation.queuedAt)
        .limit(1);
      if (!next) return null;
      const [claimed] = await db
        .update(generation)
        .set({ status: "processing", startedAt: new Date() })
        .where(and(eq(generation.id, next.id), eq(generation.status, "queued")))
        .returning();
      if (claimed) return claimed; // lost the race: try the next row
    }
    return null;
  },

  async update(id: string, patch: GenerationPatch) {
    await db.update(generation).set(patch).where(eq(generation.id, id));
  },

  /** Crash recovery: jobs that were mid-render when the process died go back to the queue. */
  async requeueProcessing() {
    const rows = await db
      .update(generation)
      .set({ status: "queued", startedAt: null })
      .where(eq(generation.status, "processing"))
      .returning({ id: generation.id });
    return rows.length;
  },

  list(filter: { projectId: string; templateId?: string; status?: GenerationStatus }, limit = 100) {
    const conds = [eq(generation.projectId, filter.projectId)];
    if (filter.templateId) conds.push(eq(generation.templateId, filter.templateId));
    if (filter.status) conds.push(eq(generation.status, filter.status));
    return db
      .select()
      .from(generation)
      .where(and(...conds))
      .orderBy(desc(generation.queuedAt))
      .limit(limit);
  },
};
