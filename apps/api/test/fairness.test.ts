import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { generationsRepository } from "../src/modules/generations/generations.repository";
import { generationsService } from "../src/modules/generations/generations.service";
import { callerFor, createUser } from "./factories";

const SCHEMA: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

async function setup(name: string) {
  const user = await createUser();
  const owner = callerFor(user);
  const project = await owner.projects.create({ name });
  const tpl = await owner.templates.create({ projectId: project.id, name: `${name} tpl` });
  const ids = { projectId: project.id, templateId: tpl.id };
  await owner.templates.saveDraft({
    ...ids,
    source: '#let data = json("data.json")',
    schema: SCHEMA,
    sampleData: { name: "Ali" },
    renderTimeoutSec: 30,
    maxPayloadKb: 64,
  });
  await owner.templates.publish(ids);
  const [version] = await db
    .select()
    .from(schema.templateVersion)
    .where(eq(schema.templateVersion.templateId, tpl.id));
  if (!version) throw new Error("no version");
  const [row] = await db.select().from(schema.project).where(eq(schema.project.id, project.id));
  if (!row) throw new Error("no project");
  return { user, project: row, ids, versionId: version.id };
}

type Ctx = Awaited<ReturnType<typeof setup>>;
let seq = 0;
const addJob = (c: Ctx, status: "queued" | "processing", queuedAtMs: number) => {
  const id = `job-${++seq}`;
  return db
    .insert(schema.generation)
    .values({
      id,
      projectId: c.project.id,
      templateId: c.ids.templateId,
      templateVersionId: c.versionId,
      source: "ui",
      status,
      inputSha256: "x",
      queuedAt: new Date(queuedAtMs),
      startedAt: status === "processing" ? new Date() : null,
    })
    .then(() => id);
};

const original = env.PROJECT_MAX_PENDING;
afterEach(() => {
  env.PROJECT_MAX_PENDING = original;
});

describe("queue fairness", () => {
  it("does not let one project's backlog starve another project", async () => {
    // Drain anything left by other tests in this file's DB.
    while (await generationsRepository.claimNext()) {}
    const busy = await setup("Busy");
    const quiet = await setup("Quiet");
    const base = Date.now() - 60_000;
    const busy1 = await addJob(busy, "queued", base);
    await addJob(busy, "queued", base + 1);
    await addJob(busy, "queued", base + 2);
    const quiet1 = await addJob(quiet, "queued", base + 3); // newest of all

    const first = await generationsRepository.claimNext();
    const second = await generationsRepository.claimNext();

    expect(first?.id).toBe(busy1); // nothing running yet: plain FIFO
    expect(second?.id).toBe(quiet1); // busy already has one running, quiet has none
  });
});

describe("project backlog cap", () => {
  it("refuses new work once the project has too many pending jobs", async () => {
    const c = await setup("Capped");
    env.PROJECT_MAX_PENDING = 2;
    await addJob(c, "queued", Date.now());
    await addJob(c, "processing", Date.now());

    const error = await generationsService
      .create({ source: "ui", userId: c.user.id }, c.project, {
        templateId: c.ids.templateId,
        data: { name: "Ali" },
      })
      .catch((e) => e);
    expect(error).toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("still records invalid data as a validation error when the project is full", async () => {
    const c = await setup("Capped invalid");
    env.PROJECT_MAX_PENDING = 1;
    await addJob(c, "queued", Date.now());
    const row = await generationsService.create({ source: "ui", userId: c.user.id }, c.project, {
      templateId: c.ids.templateId,
      data: { name: 42 },
    });
    expect(row.status).toBe("validation_error");
  });
});
