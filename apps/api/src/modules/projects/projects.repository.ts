import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { project } = schema;

export type NewProject = typeof project.$inferInsert;
export type ProjectPatch = Partial<Pick<NewProject, "name" | "description" | "retentionDays">>;

export const projectsRepository = {
  async insert(values: NewProject) {
    const [row] = await db.insert(project).values(values).returning();
    if (!row) throw new Error("project insert returned no row");
    return row;
  },

  async findById(id: string) {
    const [row] = await db.select().from(project).where(eq(project.id, id)).limit(1);
    return row ?? null;
  },

  /** Active (non-archived) projects, newest first. */
  list(filter: { ownerId?: string } = {}) {
    const where = filter.ownerId
      ? and(isNull(project.archivedAt), eq(project.ownerId, filter.ownerId))
      : isNull(project.archivedAt);
    return db.select().from(project).where(where).orderBy(desc(project.createdAt));
  },

  async update(id: string, patch: ProjectPatch) {
    const [row] = await db.update(project).set(patch).where(eq(project.id, id)).returning();
    return row ?? null;
  },

  async archive(id: string, at: Date) {
    await db.update(project).set({ archivedAt: at }).where(eq(project.id, id));
  },

  async slugExists(slug: string) {
    const [row] = await db
      .select({ id: project.id })
      .from(project)
      .where(eq(project.slug, slug))
      .limit(1);
    return Boolean(row);
  },
};
