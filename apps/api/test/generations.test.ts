import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { TemplateSchema } from "@documento/shared";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { generationsRepository } from "../src/modules/generations/generations.repository";
import { jobKey } from "../src/modules/generations/queue";
import { storage } from "../src/modules/storage/storage";
import { callerFor, createUser } from "./factories";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;
const SCHEMA: TemplateSchema = { fields: [{ name: "name", type: "string", required: true }] };
const SOURCE = '#let data = json("data.json")\nSalom, #data.name!';

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

async function setup(opts: { source?: string; timeout?: number; publish?: boolean } = {}) {
  const user = await createUser();
  const owner = callerFor(user);
  const project = await owner.projects.create({ name: "Gen project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Gen tpl" });
  const ids = { projectId: project.id, templateId: tpl.id };
  if (opts.publish !== false) {
    await owner.templates.saveDraft({
      ...ids,
      source: opts.source ?? SOURCE,
      schema: SCHEMA,
      sampleData: { name: "Ali" },
      renderTimeoutSec: opts.timeout ?? 30,
      maxPayloadKb: 64,
    });
    await owner.templates.publish(ids);
  }
  return { user, owner, ids, project };
}

describe("generations", () => {
  it("claims a queued job exactly once under concurrency", async () => {
    const { ids, project, user } = await setup();
    const version = (await db.select().from(schema.templateVersion))[0];
    if (!version) throw new Error("no version");
    await db.insert(schema.generation).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      templateId: ids.templateId,
      templateVersionId: version.id,
      createdBy: user.id,
      source: "ui",
      status: "queued",
      inputSha256: "x",
      queuedAt: new Date(0),
    });
    const claims = await Promise.all([
      generationsRepository.claimNext(),
      generationsRepository.claimNext(),
      generationsRepository.claimNext(),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("requeues interrupted jobs after a restart", async () => {
    const { ids, project, user } = await setup();
    const version = (await db.select().from(schema.templateVersion))[0];
    if (!version) throw new Error("no version");
    const id = crypto.randomUUID();
    await db.insert(schema.generation).values({
      id,
      projectId: project.id,
      templateId: ids.templateId,
      templateVersionId: version.id,
      createdBy: user.id,
      source: "ui",
      status: "processing",
      inputSha256: "x",
      queuedAt: new Date(),
      startedAt: new Date(),
    });
    expect(await generationsRepository.requeueProcessing()).toBeGreaterThanOrEqual(1);
    expect((await generationsRepository.find(id))?.status).toBe("queued");
    expect((await generationsRepository.find(id))?.startedAt).toBeNull();
  });

  it("records validation errors without queuing or storing the data", async () => {
    const { owner, ids } = await setup();
    const gen = await owner.generations.create({
      projectId: ids.projectId,
      templateId: ids.templateId,
      data: { nope: 1 },
    });
    expect(gen.status).toBe("validation_error");
    expect(JSON.stringify(gen.errorJson)).toContain("/name");
    expect(existsSync(storage.getPath(jobKey(gen.id)))).toBe(false);
  });

  it("refuses unpublished templates", async () => {
    const { owner, ids } = await setup({ publish: false });
    const e = await fail(
      owner.generations.create({
        projectId: ids.projectId,
        templateId: ids.templateId,
        data: { name: "x" },
      }),
    );
    expect(e?.code).toBe("CONFLICT");
  });

  it("hides generations from other users", async () => {
    const { owner, ids } = await setup();
    const gen = await owner.generations.create({
      projectId: ids.projectId,
      templateId: ids.templateId,
      data: {},
    });
    const other = callerFor(await createUser());
    expect(
      (await fail(other.generations.get({ projectId: ids.projectId, generationId: gen.id })))?.code,
    ).toBe("NOT_FOUND");
    expect((await fail(other.generations.list({ projectId: ids.projectId })))?.code).toBe(
      "NOT_FOUND",
    );
    expect(await owner.generations.list({ projectId: ids.projectId })).toHaveLength(1);
  });
});

describe.skipIf(!hasTypst)("generations with Typst", () => {
  it("renders, stores the PDF with expiry and removes the input file", async () => {
    const { owner, ids } = await setup();
    const gen = await owner.generations.create({ ...ids, data: { name: "Ali" }, waitMs: 15000 });
    expect(gen.status).toBe("ok");
    expect(gen.pages).toBe(1);
    expect(gen.pdfExpiresAt && gen.pdfExpiresAt.getTime() - Date.now()).toBeGreaterThan(
      23 * 3600_000,
    );
    expect(existsSync(storage.getPath(jobKey(gen.id)))).toBe(false);
    expect(existsSync(storage.getPath(`pdf/${gen.id}.pdf`))).toBe(true);
    expect(gen).not.toHaveProperty("pdfKey");
  });

  it("honours the project retention override", async () => {
    const { owner, ids } = await setup();
    await owner.projects.update({
      projectId: ids.projectId,
      name: "Gen project",
      description: null,
      retentionDays: 7,
    });
    const gen = await owner.generations.create({ ...ids, data: { name: "Ali" }, waitMs: 15000 });
    expect(gen.pdfExpiresAt && gen.pdfExpiresAt.getTime() - Date.now()).toBeGreaterThan(
      6.9 * 24 * 3600_000,
    );
  });

  it("records compile errors with diagnostics", async () => {
    const { owner, ids } = await setup({ source: "#let x = (" });
    const gen = await owner.generations.create({ ...ids, data: { name: "Ali" }, waitMs: 15000 });
    expect(gen.status).toBe("render_error");
    expect(JSON.stringify(gen.errorJson)).toContain("main.typ");
  });

  it("times out runaway templates", async () => {
    const { owner, ids } = await setup({
      source: "#range(2000000000).map(x => x * 2).len()",
      timeout: 1,
    });
    const gen = await owner.generations.create({ ...ids, data: { name: "Ali" }, waitMs: 15000 });
    expect(["timeout", "render_error"]).toContain(gen.status);
  });
});
