import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { projectsService } from "../src/modules/projects/projects.service";
import { createUser } from "./factories";

const code = (p: Promise<unknown>) =>
  p.then(
    () => "OK",
    (e: { code?: string }) => e.code,
  );

describe("projectsService", () => {
  it("generates unique slugs for same names", async () => {
    const a = await createUser();
    const p1 = await projectsService.create(a, { name: "Same name" });
    const p2 = await projectsService.create(a, { name: "Same name" });
    expect([p1.slug, p2.slug]).toEqual(["same-name", "same-name-2"]);
  });

  it("scopes list by owner; only the superadmin sees all", async () => {
    const a = await createUser();
    const b = await createUser();
    const admin = await createUser({ role: "admin" });
    const superadmin = await createUser({ role: "superadmin" });
    const pa = await projectsService.create(a, { name: "Alpha list" });
    const pb = await projectsService.create(b, { name: "Beta list" });
    const ids = (await projectsService.list(a)).map((p) => p.id);
    expect(ids).toContain(pa.id);
    expect(ids).not.toContain(pb.id);
    const superIds = (await projectsService.list(superadmin)).map((p) => p.id);
    expect(superIds).toEqual(expect.arrayContaining([pa.id, pb.id]));
    const adminIds = (await projectsService.list(admin)).map((p) => p.id);
    expect(adminIds).not.toContain(pa.id);
  });

  it("hides foreign projects with NOT_FOUND, superadmin can read", async () => {
    const a = await createUser();
    const b = await createUser();
    const admin = await createUser({ role: "admin" });
    const superadmin = await createUser({ role: "superadmin" });
    const p = await projectsService.create(a, { name: "Private" });
    expect(await code(projectsService.get(b, p.id))).toBe("NOT_FOUND");
    expect(await code(projectsService.get(b, "missing"))).toBe("NOT_FOUND");
    expect(await code(projectsService.get(admin, p.id))).toBe("NOT_FOUND");
    expect(await code(projectsService.get(superadmin, p.id))).toBe("OK");
  });

  it("archived projects vanish for everyone", async () => {
    const a = await createUser();
    const admin = await createUser({ role: "admin" });
    const p = await projectsService.create(a, { name: "To archive" });
    await projectsService.archive(a, p.id);
    expect((await projectsService.list(a)).map((x) => x.id)).not.toContain(p.id);
    expect(await code(projectsService.get(admin, p.id))).toBe("NOT_FOUND");
    expect(
      await code(
        projectsService.update(admin, {
          projectId: p.id,
          name: "x1",
          description: null,
          retentionDays: null,
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  it("validates retention bound, clears with null, keeps slug", async () => {
    const a = await createUser();
    const p = await projectsService.create(a, { name: "Retention" });
    const input = { projectId: p.id, name: "Renamed", description: "d" };
    expect(
      await code(
        projectsService.update(a, { ...input, retentionDays: env.PDF_RETENTION_MAX_DAYS + 1 }),
      ),
    ).toBe("BAD_REQUEST");
    const set = await projectsService.update(a, { ...input, retentionDays: 7 });
    expect(set.retentionDays).toBe(7);
    const cleared = await projectsService.update(a, { ...input, retentionDays: null });
    expect(cleared.retentionDays).toBeNull();
    expect(cleared.name).toBe("Renamed");
    expect(cleared.slug).toBe(p.slug);
  });
});
