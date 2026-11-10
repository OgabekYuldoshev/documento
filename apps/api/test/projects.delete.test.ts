import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Delete me" });
  const template = await owner.templates.create({ projectId: project.id, name: "Invoice" });
  const draft = (await owner.templates.draft({
    projectId: project.id,
    templateId: template.id,
  })) as { id: string };
  return { owner, project, template, draft };
}

describe("projects.delete", () => {
  it("removes the project with its templates, versions, keys and generations", async () => {
    const { owner, project, template, draft } = await setup();
    await owner.apiKeys.create({
      projectId: project.id,
      name: "Test key",
      scope: "project",
      rateLimitPerMin: 60,
    } as never);
    await db.insert(schema.generation).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      templateId: template.id,
      templateVersionId: draft.id,
      source: "ui",
      status: "ok",
      inputSha256: "x",
      queuedAt: new Date(),
    });

    await owner.projects.delete({ projectId: project.id, confirmName: "Delete me" });

    const left = async (table: typeof schema.template | typeof schema.generation, col: unknown) =>
      (
        await db
          .select()
          .from(table)
          .where(eq(col as never, project.id))
      ).length;
    expect(await left(schema.generation, schema.generation.projectId)).toBe(0);
    expect(await left(schema.template, schema.template.projectId)).toBe(0);
    expect(
      (await db.select().from(schema.project).where(eq(schema.project.id, project.id))).length,
    ).toBe(0);
    expect((await fail(owner.projects.get({ projectId: project.id })))?.code).toBe("NOT_FOUND");
  });

  it("needs the exact project name", async () => {
    const { owner, project } = await setup();
    const err = await fail(owner.projects.delete({ projectId: project.id, confirmName: "nope" }));
    expect(err?.code).toBe("BAD_REQUEST");
    expect((await owner.projects.get({ projectId: project.id })).id).toBe(project.id);
  });

  it("refuses while documents are still rendering", async () => {
    const { owner, project, template, draft } = await setup();
    await db.insert(schema.generation).values({
      id: crypto.randomUUID(),
      projectId: project.id,
      templateId: template.id,
      templateVersionId: draft.id,
      source: "ui",
      status: "processing",
      inputSha256: "x",
      queuedAt: new Date(),
    });
    const err = await fail(
      owner.projects.delete({ projectId: project.id, confirmName: "Delete me" }),
    );
    expect(err?.code).toBe("CONFLICT");
  });

  it("does not let a stranger delete someone else's project", async () => {
    const { project } = await setup();
    const stranger = callerFor(await createUser());
    const err = await fail(
      stranger.projects.delete({ projectId: project.id, confirmName: "Delete me" }),
    );
    expect(err?.code).toBe("NOT_FOUND");
  });
});
