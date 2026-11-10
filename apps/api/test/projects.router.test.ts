import { describe, expect, it } from "vitest";
import { anonymousCaller, callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

describe("projects router", () => {
  it("owner can create and get", async () => {
    const a = callerFor(await createUser());
    const p = await a.projects.create({ name: "Router one" });
    expect((await a.projects.get({ projectId: p.id })).id).toBe(p.id);
  });

  it("foreign and missing ids give identical NOT_FOUND", async () => {
    const a = callerFor(await createUser());
    const b = callerFor(await createUser());
    const p = await a.projects.create({ name: "Router two" });
    const foreign = await fail(b.projects.get({ projectId: p.id }));
    const missing = await fail(b.projects.get({ projectId: "missing" }));
    expect(foreign?.code).toBe("NOT_FOUND");
    expect(missing?.code).toBe("NOT_FOUND");
    expect(foreign?.message).toBe(missing?.message);
    const upd = await fail(
      b.projects.update({ projectId: p.id, name: "Hack", description: null, retentionDays: null }),
    );
    expect(upd?.code).toBe("NOT_FOUND");
    expect((await fail(b.projects.archive({ projectId: p.id })))?.code).toBe("NOT_FOUND");
  });

  it("superadmin lists everyone's projects, admin only its own", async () => {
    const a = callerFor(await createUser());
    const b = callerFor(await createUser());
    const admin = callerFor(await createUser({ role: "admin" }));
    const superadmin = callerFor(await createUser({ role: "superadmin" }));
    const pa = await a.projects.create({ name: "Router three" });
    const pb = await b.projects.create({ name: "Router four" });
    const all = (await superadmin.projects.list()).map((p) => p.id);
    expect(all).toEqual(expect.arrayContaining([pa.id, pb.id]));
    const adminIds = (await admin.projects.list()).map((p) => p.id);
    expect(adminIds).not.toContain(pa.id);
    expect(adminIds).not.toContain(pb.id);
  });

  it("rejects anonymous callers", async () => {
    expect((await fail(anonymousCaller().projects.list()))?.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid retention via zod", async () => {
    const a = callerFor(await createUser());
    const p = await a.projects.create({ name: "Router five" });
    const err = await fail(
      a.projects.update({
        projectId: p.id,
        name: "Router five",
        description: null,
        retentionDays: 0,
      }),
    );
    expect(err?.code).toBe("BAD_REQUEST");
  });

  it("archive removes from list", async () => {
    const a = callerFor(await createUser());
    const p = await a.projects.create({ name: "Router six" });
    await a.projects.archive({ projectId: p.id });
    expect((await a.projects.list()).map((x) => x.id)).not.toContain(p.id);
  });
});
