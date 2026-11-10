import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { project, template, templateVersion, templateAsset, generation, apiKey, upload } = schema;

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

  /** Jobs that are still queued or rendering (a project cannot be removed under them). */
  async activeJobs(id: string) {
    const rows = await db
      .select({ id: generation.id })
      .from(generation)
      .where(
        and(eq(generation.projectId, id), inArray(generation.status, ["queued", "processing"])),
      )
      .limit(1);
    return rows.length;
  },

  /**
   * Permanently removes a project with everything under it (FKs are `restrict`, so children go
   * first) in one transaction. Returns the storage keys of the files to delete afterwards.
   */
  async deleteCascade(id: string): Promise<string[]> {
    return db.transaction(async (tx) => {
      const templateIds = (
        await tx.select({ id: template.id }).from(template).where(eq(template.projectId, id))
      ).map((t) => t.id);

      const pdfs = await tx
        .select({ key: generation.pdfKey })
        .from(generation)
        .where(eq(generation.projectId, id));
      const uploads = await tx
        .select({ key: upload.storageKey })
        .from(upload)
        .where(eq(upload.projectId, id));
      const assets = templateIds.length
        ? await tx
            .select({ key: templateAsset.storageKey })
            .from(templateAsset)
            .where(inArray(templateAsset.templateId, templateIds))
        : [];

      await tx.delete(generation).where(eq(generation.projectId, id));
      await tx.delete(upload).where(eq(upload.projectId, id));
      await tx.delete(apiKey).where(eq(apiKey.projectId, id));
      if (templateIds.length) {
        await tx.delete(templateAsset).where(inArray(templateAsset.templateId, templateIds));
        await tx.delete(templateVersion).where(inArray(templateVersion.templateId, templateIds));
        await tx.delete(template).where(inArray(template.id, templateIds));
      }
      await tx.delete(project).where(eq(project.id, id));

      return [
        ...pdfs.map((p) => p.key),
        ...uploads.map((u) => u.key),
        ...assets.map((a) => a.key),
      ].filter((k): k is string => Boolean(k));
    });
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
