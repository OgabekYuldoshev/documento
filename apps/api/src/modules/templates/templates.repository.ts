import { and, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { db, schema } from "../../db/client";

const { template, templateVersion } = schema;

/** The shared db or a transaction handle. */
export type Executor = Pick<typeof db, "select" | "insert" | "update">;

export type NewTemplate = typeof template.$inferInsert;
export type NewVersion = typeof templateVersion.$inferInsert;
export type VersionPatch = Partial<
  Pick<
    NewVersion,
    | "source"
    | "schema"
    | "sampleData"
    | "renderTimeoutSec"
    | "maxPayloadKb"
    | "status"
    | "publishedAt"
    | "publishedBy"
    | "checksum"
  >
>;

const first = <T>(rows: T[]) => rows[0] ?? null;

export const templatesRepository = {
  async insertTemplate(values: NewTemplate, x: Executor = db) {
    const row = first(await x.insert(template).values(values).returning());
    if (!row) throw new Error("template insert returned no row");
    return row;
  },

  async findTemplate(id: string, x: Executor = db) {
    return first(await x.select().from(template).where(eq(template.id, id)).limit(1));
  },

  listByProject(projectId: string) {
    return db
      .select()
      .from(template)
      .where(and(eq(template.projectId, projectId), isNull(template.archivedAt)))
      .orderBy(desc(template.createdAt));
  },

  async slugExists(projectId: string, slug: string) {
    const row = first(
      await db
        .select({ id: template.id })
        .from(template)
        .where(and(eq(template.projectId, projectId), eq(template.slug, slug)))
        .limit(1),
    );
    return Boolean(row);
  },

  async setCurrent(templateId: string, versionId: string, x: Executor = db) {
    await x
      .update(template)
      .set({ currentVersionId: versionId })
      .where(eq(template.id, templateId));
  },

  async archiveTemplate(id: string, at: Date) {
    await db.update(template).set({ archivedAt: at }).where(eq(template.id, id));
  },

  async insertVersion(values: NewVersion, x: Executor = db) {
    const row = first(await x.insert(templateVersion).values(values).returning());
    if (!row) throw new Error("version insert returned no row");
    return row;
  },

  async findVersion(id: string, x: Executor = db) {
    return first(await x.select().from(templateVersion).where(eq(templateVersion.id, id)).limit(1));
  },

  async findDraft(templateId: string, x: Executor = db) {
    return first(
      await x
        .select()
        .from(templateVersion)
        .where(and(eq(templateVersion.templateId, templateId), eq(templateVersion.status, "draft")))
        .limit(1),
    );
  },

  async findCurrent(templateId: string, x: Executor = db) {
    const tpl = await templatesRepository.findTemplate(templateId, x);
    return tpl?.currentVersionId ? templatesRepository.findVersion(tpl.currentVersionId, x) : null;
  },

  listVersions(templateId: string) {
    return db
      .select({
        id: templateVersion.id,
        number: templateVersion.number,
        status: templateVersion.status,
        publishedAt: templateVersion.publishedAt,
        publishedBy: templateVersion.publishedBy,
        checksum: templateVersion.checksum,
        createdAt: templateVersion.createdAt,
      })
      .from(templateVersion)
      .where(eq(templateVersion.templateId, templateId))
      .orderBy(desc(templateVersion.number));
  },

  listVersionsFull(templateId: string) {
    return db.select().from(templateVersion).where(eq(templateVersion.templateId, templateId));
  },

  /** Version status summary for many templates (avoids N+1 on list). */
  versionSummaries(templateIds: string[]) {
    if (templateIds.length === 0) return Promise.resolve([]);
    return db
      .select({
        templateId: templateVersion.templateId,
        id: templateVersion.id,
        number: templateVersion.number,
        status: templateVersion.status,
      })
      .from(templateVersion)
      .where(inArray(templateVersion.templateId, templateIds));
  },

  async updateVersion(id: string, patch: VersionPatch, x: Executor = db) {
    const row = first(
      await x.update(templateVersion).set(patch).where(eq(templateVersion.id, id)).returning(),
    );
    if (!row) throw new Error("version update matched no row");
    return row;
  },

  async nextNumber(templateId: string, x: Executor = db) {
    const row = first(
      await x
        .select({ n: max(templateVersion.number) })
        .from(templateVersion)
        .where(eq(templateVersion.templateId, templateId)),
    );
    return (row?.n ?? 0) + 1;
  },
};
