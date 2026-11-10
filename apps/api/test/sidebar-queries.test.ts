import { describe, expect, it } from "vitest";
import { callerFor, createUser } from "./factories";

describe("sidebar queries", () => {
  it("lists recent templates only from the caller's own projects", async () => {
    const owner = callerFor(await createUser());
    const other = callerFor(await createUser());
    const project = await owner.projects.create({ name: "Mine" });
    const theirs = await other.projects.create({ name: "Theirs" });
    const mine = await owner.templates.create({ projectId: project.id, name: "Invoice" });
    await other.templates.create({ projectId: theirs.id, name: "Secret" });

    const recent = await owner.templates.recent();
    expect(recent.map((t) => t.id)).toEqual([mine.id]);
    expect(recent[0]).toMatchObject({ projectId: project.id, projectName: "Mine" });
  });

  it("reports render activity as zero counts for a fresh user", async () => {
    const owner = callerFor(await createUser());
    expect(await owner.generations.activity()).toEqual({ running: 0, failed: 0 });
  });
});
