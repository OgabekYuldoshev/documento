import { desc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { db, schema } from "../src/db/client";
import { usersService } from "../src/modules/users/users.service";
import { anonymousCaller, callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

const rows = (action: string) =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

describe("audit log", () => {
  it("records project lifecycle with the actor and a name snapshot", async () => {
    const owner = await createUser({ name: "Audit Owner", email: "audit-owner@test.local" });
    const caller = callerFor(owner);
    const project = await caller.projects.create({ name: "Audited project" });
    await caller.projects.update({
      projectId: project.id,
      name: "Audited project",
      description: null,
      retentionDays: null,
    });
    await caller.projects.delete({ projectId: project.id, confirmName: "Audited project" });

    const trail = (
      await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.createdAt))
    ).filter((r) => r.targetId === project.id);
    expect(trail.map((r) => r.action).sort()).toEqual([
      "project.created",
      "project.deleted",
      "project.updated",
    ]);
    expect(trail[0]?.actorId).toBe(owner.id);
    expect(trail[0]?.actorLabel).toBe("Audit Owner <audit-owner@test.local>");
    // The row outlives the deleted project.
    expect(trail.every((r) => r.targetLabel === "Audited project")).toBe(true);
  });

  it("records API key creation and revocation", async () => {
    const caller = callerFor(await createUser());
    const project = await caller.projects.create({ name: "Keys audit" });
    const { key } = await caller.apiKeys.create({
      projectId: project.id,
      name: "Audit key",
      scope: "project",
      rateLimitPerMin: 60,
    });
    await caller.apiKeys.revoke({ projectId: project.id, apiKeyId: key.id });
    expect((await rows("api_key.created")).some((r) => r.targetId === key.id)).toBe(true);
    expect((await rows("api_key.revoked")).some((r) => r.targetId === key.id)).toBe(true);
  });

  it("is readable by admins only, with action filter", async () => {
    const admin = callerFor(await createUser({ role: "admin" }));
    const user = callerFor(await createUser());
    expect((await fail(user.audit.list({})))?.code).toBe("FORBIDDEN");
    expect((await fail(anonymousCaller().audit.list({})))?.code).toBe("UNAUTHORIZED");

    await user.projects.create({ name: "Filter me" });
    const list = await admin.audit.list({ action: "project.created", search: "Filter me" });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.action === "project.created")).toBe(true);
  });
});

describe("users.resetPassword rules", () => {
  it("admin cannot reset an admin, a superadmin or themselves", async () => {
    const admin = await createUser({ role: "admin" });
    const other = await createUser({ role: "admin" });
    const root = await createUser({ role: "superadmin" });
    const call = (id: string) =>
      fail(usersService.resetPassword(admin, new Headers(), id, "NewPassword123"));
    expect((await call(other.id))?.code).toBe("FORBIDDEN");
    expect((await call(root.id))?.code).toBe("FORBIDDEN");
    expect((await call(admin.id))?.code).toBe("FORBIDDEN");
  });

  it("is admin-only at the router", async () => {
    const user = callerFor(await createUser());
    const target = await createUser();
    const error = await fail(
      user.users.resetPassword({ id: target.id, newPassword: "NewPassword123" }),
    );
    expect(error?.code).toBe("FORBIDDEN");
  });
});

describe("sign-in throttle", () => {
  it("locks an email after repeated failures and audits it", async () => {
    const email = "ghost@test.local";
    const attempt = () =>
      app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.0.5",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email, password: "wrong-password" }),
      });

    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await attempt()).status);
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
    expect(statuses[6]).toBe(429);

    const blocked = await attempt();
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(((await blocked.json()) as { code: string }).code).toBe("TOO_MANY_ATTEMPTS");

    expect((await rows("auth.login_failed")).filter((r) => r.actorLabel === email)).toHaveLength(5);
    expect((await rows("auth.login_blocked")).some((r) => r.actorLabel === email)).toBe(true);
  });
});
