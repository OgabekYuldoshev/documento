import { describe, expect, it } from "vitest";
import { notifyJobFinished, waitForJobSignal } from "../src/modules/generations/job-events";
import { estimateRenderMb } from "../src/modules/render/render.service";
import { callerFor, createUser } from "./factories";

describe("projects.page", () => {
  it("pages, counts and searches only what the actor may see", async () => {
    const user = await createUser();
    const other = await createUser();
    const me = callerFor(user);
    const tag = `Pg${Date.now()}`;
    for (let i = 0; i < 5; i++) await me.projects.create({ name: `${tag} alpha ${i}` });
    await me.projects.create({ name: `${tag} beta`, description: "needle_%" });
    await callerFor(other).projects.create({ name: `${tag} foreign` });

    const first = await me.projects.page({ limit: 4, offset: 0, search: tag });
    expect(first.total).toBe(6);
    expect(first.items).toHaveLength(4);
    const second = await me.projects.page({ limit: 4, offset: 4, search: tag });
    expect(second.items).toHaveLength(2);
    const ids = new Set([...first.items, ...second.items].map((p) => p.id));
    expect(ids.size).toBe(6);

    // search matches the description, and % / _ are literal
    expect((await me.projects.page({ search: "needle_%" })).total).toBe(1);
    expect((await me.projects.page({ search: "needle__" })).total).toBe(0);
    expect((await me.projects.page({ search: "%" })).total).toBe(1);
  });

  it("rejects an oversized page", async () => {
    const me = callerFor(await createUser());
    await expect(me.projects.page({ limit: 1000 })).rejects.toThrow();
  });
});

describe("render memory estimate", () => {
  it("is small for tiny payloads and grows with payload and images", () => {
    expect(estimateRenderMb(2_000, 0)).toBeLessThan(100);
    expect(estimateRenderMb(1024 * 1024, 0)).toBeGreaterThan(400);
    expect(estimateRenderMb(1000, 2)).toBeGreaterThan(estimateRenderMb(1000, 0));
  });
});

describe("job signals", () => {
  it("wakes a waiter at once and times out otherwise", async () => {
    const waiter = waitForJobSignal("job-a", 5000);
    const t0 = Date.now();
    notifyJobFinished("job-a");
    await waiter.promise;
    expect(Date.now() - t0).toBeLessThan(200);

    const t1 = Date.now();
    await waitForJobSignal("job-b", 50).promise;
    expect(Date.now() - t1).toBeGreaterThanOrEqual(40);
  });
});
