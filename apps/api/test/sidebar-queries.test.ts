import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { usersService } from "../src/modules/users/users.service";
import { callerFor, createUser } from "./factories";

describe("sidebar and dashboard queries", () => {
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

  it("builds the home feed and counters from the caller's own generations only", async () => {
    const owner = callerFor(await createUser());
    const other = callerFor(await createUser());
    const project = await owner.projects.create({ name: "Mine" });
    const theirs = await other.projects.create({ name: "Theirs" });
    const mine = await owner.templates.create({ projectId: project.id, name: "Invoice" });
    const foreign = await other.templates.create({ projectId: theirs.id, name: "Secret" });

    const insert = async (
      p: { id: string },
      t: { id: string },
      status: "ok" | "render_error" | "queued",
    ) => {
      const draft = await (p.id === project.id ? owner : other).templates.draft({
        projectId: p.id,
        templateId: t.id,
      });
      await db.insert(schema.generation).values({
        id: crypto.randomUUID(),
        projectId: p.id,
        templateId: t.id,
        templateVersionId: (draft as { id: string }).id,
        source: "ui",
        status,
        inputSha256: "x",
        queuedAt: new Date(),
      });
    };
    await insert(project, mine, "ok");
    await insert(project, mine, "render_error");
    await insert(project, mine, "queued");
    await insert(theirs, foreign, "ok");

    const home = await owner.dashboard.home();
    expect(home.recent).toHaveLength(3);
    expect(home.recent.every((g) => g.projectName === "Mine" && g.templateName === "Invoice")).toBe(
      true,
    );
    expect(home.activity).toEqual({ running: 1, failed: 1, last24h: 3, last7d: 3 });
  });

  it("builds a per-day user growth series ending with today's total", async () => {
    await createUser();
    const growth = await usersService.growth(7);
    expect(growth).toHaveLength(7);
    const last = growth[growth.length - 1];
    expect(last?.total).toBeGreaterThanOrEqual(1);
    expect(last?.new).toBeGreaterThanOrEqual(1);
    // Cumulative totals never go down.
    expect(growth.every((g, i) => i === 0 || g.total >= (growth[i - 1]?.total ?? 0))).toBe(true);
  });
});
