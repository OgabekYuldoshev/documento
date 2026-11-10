import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { db, schema } from "../../db/client";
import type { GenerationStatus } from "../../db/schema";
import { visibleTo } from "../projects/access";

const { generation, project, template } = schema;

export type NewGeneration = typeof generation.$inferInsert;
export type GenerationPatch = Partial<Omit<NewGeneration, "id">>;

export const generationsRepository = {
  /** Job counters across the projects in scope (sidebar status, dashboard cards). */
  async activity(filter: { userId?: string }, now: Date) {
    const day = new Date(now.getTime() - 24 * 60 * 60_000);
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
    const [row] = await db
      .select({
        running: sql<number>`count(*) filter (where ${inArray(generation.status, ["queued", "processing"])})`,
        failed: sql<number>`count(*) filter (where ${and(
          inArray(generation.status, ["render_error", "timeout"]),
          gte(generation.queuedAt, day),
        )})`,
        last24h: sql<number>`count(*) filter (where ${gte(generation.queuedAt, day)})`,
        last7d: sql<number>`count(*) filter (where ${gte(generation.queuedAt, week)})`,
      })
      .from(generation)
      .innerJoin(project, eq(project.id, generation.projectId))
      .where(filter.userId ? visibleTo(filter.userId) : undefined);
    return {
      running: Number(row?.running ?? 0),
      failed: Number(row?.failed ?? 0),
      last24h: Number(row?.last24h ?? 0),
      last7d: Number(row?.last7d ?? 0),
    };
  },

  /** Latest generations with template and project names (dashboard feed). */
  recentWithContext(filter: { userId?: string }, limit: number) {
    return db
      .select({
        id: generation.id,
        projectId: generation.projectId,
        templateId: generation.templateId,
        templateName: template.name,
        projectName: project.name,
        source: generation.source,
        status: generation.status,
        errorJson: generation.errorJson,
        pages: generation.pages,
        bytes: generation.bytes,
        durationMs: generation.durationMs,
        queuedAt: generation.queuedAt,
        pdfExpiresAt: generation.pdfExpiresAt,
      })
      .from(generation)
      .innerJoin(project, eq(project.id, generation.projectId))
      .innerJoin(template, eq(template.id, generation.templateId))
      .where(filter.userId ? visibleTo(filter.userId) : undefined)
      .orderBy(desc(generation.queuedAt))
      .limit(limit);
  },

  async insert(values: NewGeneration) {
    const [row] = await db.insert(generation).values(values).returning();
    if (!row) throw new Error("generation insert returned no row");
    return row;
  },

  async find(id: string) {
    const [row] = await db.select().from(generation).where(eq(generation.id, id)).limit(1);
    return row ?? null;
  },

  async findByIdempotency(apiKeyId: string, idempotencyKey: string) {
    const [row] = await db
      .select()
      .from(generation)
      .where(and(eq(generation.apiKeyId, apiKeyId), eq(generation.idempotencyKey, idempotencyKey)))
      .limit(1);
    return row ?? null;
  },

  /** Frees an expired idempotency key so the same key can start a new generation. */
  async clearIdempotency(id: string) {
    await db.update(generation).set({ idempotencyKey: null }).where(eq(generation.id, id));
  },

  /** Queued + processing jobs of a project (backlog cap). */
  async countPending(projectId: string) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(generation)
      .where(
        and(
          eq(generation.projectId, projectId),
          inArray(generation.status, ["queued", "processing"]),
        ),
      );
    return Number(row?.n ?? 0);
  },

  /**
   * Next job, atomically flipped to `processing`; null when the queue is empty. Projects with
   * fewer jobs running right now go first (so one project's backlog cannot starve the others);
   * inside a project the oldest job goes first.
   */
  async claimNext() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const [next] = await db
        .select({ id: generation.id })
        .from(generation)
        .where(eq(generation.status, "queued"))
        .orderBy(
          sql`(select count(*) from ${generation} as running
               where running.project_id = ${generation.projectId} and running.status = 'processing')`,
          generation.queuedAt,
        )
        .limit(1);
      if (!next) return null;
      const [claimed] = await db
        .update(generation)
        .set({
          status: "processing",
          startedAt: new Date(),
          attempts: sql`${generation.attempts} + 1`,
        })
        .where(and(eq(generation.id, next.id), eq(generation.status, "queued")))
        .returning();
      if (claimed) return claimed; // lost the race: try the next row
    }
    return null;
  },

  async update(id: string, patch: GenerationPatch) {
    await db.update(generation).set(patch).where(eq(generation.id, id));
  },

  /**
   * Recovery for jobs stuck in `processing` (process crash, or a failure that could not be
   * recorded). Jobs that already used `maxAttempts` claims are abandoned as `render_error` so a
   * poison job cannot crash-loop the worker; the rest go back to the queue.
   * `startedBefore` limits it to old jobs; `skip` lists jobs this process is still running.
   */
  async recoverStalled(opts: { maxAttempts: number; startedBefore?: Date; skip?: string[] }) {
    const conds = [eq(generation.status, "processing")];
    if (opts.startedBefore) {
      const old = or(isNull(generation.startedAt), lt(generation.startedAt, opts.startedBefore));
      if (old) conds.push(old);
    }
    if (opts.skip?.length) conds.push(notInArray(generation.id, opts.skip));
    const stalled = await db
      .select({ id: generation.id, attempts: generation.attempts })
      .from(generation)
      .where(and(...conds));

    const dead = stalled.filter((r) => r.attempts >= opts.maxAttempts).map((r) => r.id);
    const retry = stalled.filter((r) => r.attempts < opts.maxAttempts).map((r) => r.id);
    // `status = processing` is re-checked so a job that just finished is never overwritten.
    if (dead.length > 0) {
      await db
        .update(generation)
        .set({
          status: "render_error",
          finishedAt: new Date(),
          errorJson: {
            ok: false,
            kind: "internal",
            diagnostics: [
              { severity: "error", message: "Ichki xatolik: render qayta-qayta uzildi" },
            ],
          },
        })
        .where(and(inArray(generation.id, dead), eq(generation.status, "processing")));
    }
    if (retry.length > 0) {
      await db
        .update(generation)
        .set({ status: "queued", startedAt: null })
        .where(and(inArray(generation.id, retry), eq(generation.status, "processing")));
    }
    return { requeued: retry, abandoned: dead };
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

  /** Finished PDFs whose retention has run out. */
  expiredPdfs(now: Date, limit = 500) {
    return db
      .select()
      .from(generation)
      .where(
        and(
          eq(generation.status, "ok"),
          isNotNull(generation.pdfExpiresAt),
          lte(generation.pdfExpiresAt, now),
        ),
      )
      .limit(limit);
  },
};
