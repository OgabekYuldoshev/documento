import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { upload } = schema;

export type NewUpload = typeof upload.$inferInsert;

export const uploadsRepository = {
  async insert(values: NewUpload) {
    const [row] = await db.insert(upload).values(values).returning();
    if (!row) throw new Error("upload insert returned no row");
    return row;
  },

  /** Non-expired uploads of this project among `ids`. */
  findUsable(projectId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return db
      .select()
      .from(upload)
      .where(
        and(
          eq(upload.projectId, projectId),
          inArray(upload.id, ids),
          gt(upload.expiresAt, new Date()),
        ),
      );
  },

  async activeBytes(projectId: string) {
    const [row] = await db
      .select({ total: sql<number>`coalesce(sum(${upload.size}), 0)` })
      .from(upload)
      .where(and(eq(upload.projectId, projectId), gt(upload.expiresAt, new Date())));
    return Number(row?.total ?? 0);
  },

  async extend(ids: string[], expiresAt: Date) {
    if (ids.length === 0) return;
    await db
      .update(upload)
      .set({ expiresAt })
      .where(and(inArray(upload.id, ids), lte(upload.expiresAt, expiresAt)));
  },

  expired: (now: Date) => db.select().from(upload).where(lte(upload.expiresAt, now)),

  async remove(id: string) {
    await db.delete(upload).where(eq(upload.id, id));
  },
};
