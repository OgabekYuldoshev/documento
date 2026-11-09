import { and, eq } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { templateAsset } = schema;

export type NewAsset = typeof templateAsset.$inferInsert;

export const assetsRepository = {
  list: (templateId: string) =>
    db.select().from(templateAsset).where(eq(templateAsset.templateId, templateId)),

  async find(templateId: string, id: string) {
    const [row] = await db
      .select()
      .from(templateAsset)
      .where(and(eq(templateAsset.templateId, templateId), eq(templateAsset.id, id)))
      .limit(1);
    return row ?? null;
  },

  async insert(values: NewAsset) {
    const [row] = await db.insert(templateAsset).values(values).returning();
    if (!row) throw new Error("asset insert returned no row");
    return row;
  },

  async remove(id: string) {
    await db.delete(templateAsset).where(eq(templateAsset.id, id));
  },
};
