import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { apiKey } = schema;

export type NewApiKey = typeof apiKey.$inferInsert;

export const apiKeysRepository = {
  async insert(values: NewApiKey) {
    const [row] = await db.insert(apiKey).values(values).returning();
    if (!row) throw new Error("api key insert returned no row");
    return row;
  },

  list: (projectId: string) =>
    db.select().from(apiKey).where(eq(apiKey.projectId, projectId)).orderBy(desc(apiKey.createdAt)),

  async findByPrefix(prefix: string) {
    const [row] = await db.select().from(apiKey).where(eq(apiKey.prefix, prefix)).limit(1);
    return row ?? null;
  },

  async find(projectId: string, id: string) {
    const [row] = await db
      .select()
      .from(apiKey)
      .where(and(eq(apiKey.projectId, projectId), eq(apiKey.id, id)))
      .limit(1);
    return row ?? null;
  },

  async revoke(id: string, at: Date) {
    await db.update(apiKey).set({ revokedAt: at }).where(eq(apiKey.id, id));
  },

  async touch(id: string, at: Date) {
    await db.update(apiKey).set({ lastUsedAt: at }).where(eq(apiKey.id, id));
  },
};
