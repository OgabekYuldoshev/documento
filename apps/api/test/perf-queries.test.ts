import { describe, expect, it } from "vitest";
import { sqlite as client } from "../src/db/client";
import { templatesRepository } from "../src/modules/templates/templates.repository";
import { callerFor, createUser } from "./factories";

async function twoTemplates() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Perf project" });
  const make = async (name: string) => {
    const tpl = await owner.templates.create({ projectId: project.id, name });
    const ids = { projectId: project.id, templateId: tpl.id };
    const draft = await owner.templates.getDraft(ids);
    await owner.templates.publish(ids);
    return { id: tpl.id, draftId: draft.id };
  };
  return { a: await make("Alpha"), b: await make("Beta") };
}

describe("template version lookups", () => {
  it("finds one version by number without loading the others", async () => {
    const { a } = await twoTemplates();
    const v1 = await templatesRepository.findVersionByNumber(a.id, 1);
    expect(v1).toMatchObject({ id: a.draftId, number: 1, status: "published" });
    expect(await templatesRepository.findVersionByNumber(a.id, 99)).toBeNull();
  });

  it("loads the current version of many templates in one go", async () => {
    const { a, b } = await twoTemplates();
    const map = await templatesRepository.currentVersions([a.id, b.id]);
    expect(map.get(a.id)?.number).toBe(1);
    expect(map.get(b.id)?.number).toBe(1);
    expect(map.size).toBe(2);
    expect((await templatesRepository.currentVersions([])).size).toBe(0);
  });
});

describe("sqlite connection", () => {
  it("waits for locks instead of failing at once, and enforces foreign keys", async () => {
    const value = async (pragma: string) =>
      Object.values((await client.execute(`PRAGMA ${pragma}`)).rows[0] ?? {})[0];
    expect(Number(await value("busy_timeout"))).toBeGreaterThanOrEqual(5000);
    expect(Number(await value("foreign_keys"))).toBe(1);
  });
});
