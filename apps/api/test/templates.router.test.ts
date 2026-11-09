import type { TemplateSchema } from "@documento/shared";
import { describe, expect, it } from "vitest";
import { callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

const schemaA: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" }, age: { type: "integer" } },
  required: ["name"],
  additionalProperties: false,
};

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Tpl project" });
  const projectId = project.id;
  const template = await owner.templates.create({ projectId, name: "Invoice" });
  const ids = { projectId, templateId: template.id };
  const save = (
    over: Partial<{
      schema: TemplateSchema;
      sampleData: Record<string, unknown>;
      source: string;
    }> = {},
  ) =>
    owner.templates.saveDraft({
      ...ids,
      source: over.source ?? '#let data = json("data.json")',
      schema: over.schema ?? schemaA,
      sampleData: over.sampleData ?? { name: "Ali" },
      renderTimeoutSec: 60,
      maxPayloadKb: 1024,
    });
  return { owner, ids, projectId, template, save };
}

describe("templates router", () => {
  it("creates a template with a starter draft v1", async () => {
    const { owner, ids } = await setup();
    const info = await owner.templates.get(ids);
    expect(info.draft?.number).toBe(1);
    expect(info.current).toBeNull();
    const draft = await owner.templates.getDraft(ids);
    expect(draft.source).toContain('json("data.json")');
    expect((await owner.templates.getDraft(ids)).id).toBe(draft.id);
  });

  it("hides templates from other users and across projects", async () => {
    const { ids, owner } = await setup();
    const other = callerFor(await createUser());
    expect((await fail(other.templates.get(ids)))?.code).toBe("NOT_FOUND");
    const p2 = await owner.projects.create({ name: "Second project" });
    const cross = await fail(owner.templates.get({ projectId: p2.id, templateId: ids.templateId }));
    expect(cross?.code).toBe("NOT_FOUND");
  });

  it("rejects invalid schema and oversized source on save", async () => {
    const { save } = await setup();
    const bad = await fail(
      save({
        schema: { type: "object", properties: { a: { type: "string", pattern: "(a+)+$" } } },
      }),
    );
    expect(bad?.code).toBe("BAD_REQUEST");
    const unknownFormat = await fail(
      save({ schema: { type: "object", properties: { a: { type: "string", format: "nope" } } } }),
    );
    expect(unknownFormat?.message).toContain("Schema noto'g'ri");
    expect((await fail(save({ source: "x".repeat(512 * 1024 + 1) })))?.code).toBe("BAD_REQUEST");
  });

  it("publishes, archives the previous version and keeps a stable checksum", async () => {
    const { owner, ids, save } = await setup();
    await save();
    const { version: v1 } = await owner.templates.publish(ids);
    expect(v1.status).toBe("published");
    expect(v1.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect((await fail(owner.templates.publish(ids)))?.code).toBe("CONFLICT"); // no draft
    expect((await fail(save()))?.code).toBe("CONFLICT"); // published is immutable

    const draft2 = await owner.templates.getDraft(ids);
    expect(draft2.number).toBe(2);
    await save();
    const { version: v2 } = await owner.templates.publish(ids);
    expect(v2.checksum).toBe(v1.checksum);
    const versions = await owner.templates.versions(ids);
    expect(versions.map((v) => `${v.number}:${v.status}`)).toEqual(["2:published", "1:archived"]);
    expect((await owner.templates.get(ids)).current?.number).toBe(2);
  });

  it("refuses to publish sample data that violates the schema", async () => {
    const { owner, ids, save } = await setup();
    await save({ sampleData: { age: 3 } });
    const e = await fail(owner.templates.publish(ids));
    expect(e?.code).toBe("BAD_REQUEST");
    expect(e?.message).toContain("/name");
  });

  it("requires acknowledgement for breaking changes", async () => {
    const { owner, ids, save } = await setup();
    await save();
    await owner.templates.publish(ids);
    await owner.templates.getDraft(ids);
    await save({
      schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    });
    const e = await fail(owner.templates.publish(ids));
    expect(e?.code).toBe("CONFLICT");
    expect(e?.message).toContain("/age");
    const ok = await owner.templates.publish({ ...ids, acknowledgeBreaking: true });
    expect(ok.breaking.map((b) => b.kind)).toEqual(["removed"]);
  });

  it("restores an old version into the draft", async () => {
    const { owner, ids, save } = await setup();
    await save({ source: "v1 source" });
    const { version: v1 } = await owner.templates.publish(ids);
    await owner.templates.getDraft(ids);
    await save({ source: "v2 source" });
    await owner.templates.publish(ids);
    const restored = await owner.templates.restoreVersion({ ...ids, versionId: v1.id });
    expect(restored.status).toBe("draft");
    expect(restored.source).toBe("v1 source");
    expect(restored.number).toBe(3);
  });

  it("lists templates with draft/current info and hides archived", async () => {
    const { owner, ids, projectId } = await setup();
    let list = await owner.templates.list({ projectId });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ hasDraft: true, currentNumber: null, slug: "invoice" });
    await owner.templates.archive(ids);
    list = await owner.templates.list({ projectId });
    expect(list).toHaveLength(0);
    expect((await fail(owner.templates.get(ids)))?.code).toBe("NOT_FOUND");
  });
});
