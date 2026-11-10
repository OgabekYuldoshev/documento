import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { usersRepository } from "../src/modules/users/users.repository";
import { callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

async function setup() {
  const ownerUser = await createUser();
  const memberUser = await createUser();
  const outsiderUser = await createUser();
  const adminUser = await createUser({ role: "admin" });
  const superUser = await createUser({ role: "superadmin" });
  const owner = callerFor(ownerUser);
  const member = callerFor(memberUser);
  const outsider = callerFor(outsiderUser);
  const admin = callerFor(adminUser);
  const superadmin = callerFor(superUser);
  const project = await owner.projects.create({ name: "Team project" });
  const projectId = project.id;
  await owner.projectMembers.add({ projectId, email: memberUser.email });
  return {
    ownerUser,
    memberUser,
    outsiderUser,
    adminUser,
    superUser,
    owner,
    member,
    outsider,
    admin,
    superadmin,
    projectId,
  };
}

describe("project access", () => {
  it("shows the project to its members and lets them work in it", async () => {
    const { member, projectId } = await setup();
    expect((await member.projects.list()).map((p) => p.id)).toContain(projectId);
    expect((await member.projects.get({ projectId })).id).toBe(projectId);
    const tpl = await member.templates.create({ projectId, name: "Member template" });
    expect(tpl.id).toBeTruthy();
    const { secret } = await member.apiKeys.create({
      projectId,
      name: "Member key",
      scope: "project",
    });
    expect(secret).toMatch(/^dk_live_/);
    const updated = await member.projects.update({
      projectId,
      name: "Renamed by member",
      description: null,
      retentionDays: null,
    });
    expect(updated.name).toBe("Renamed by member");
  });

  it("members also see the project's templates in their recent list", async () => {
    const { owner, member, projectId } = await setup();
    const tpl = await owner.templates.create({ projectId, name: "Owner template" });
    expect((await member.templates.recent()).map((t) => t.id)).toContain(tpl.id);
  });

  it("hides the project from people who are not members", async () => {
    const { outsider, projectId } = await setup();
    expect((await outsider.projects.list()).map((p) => p.id)).not.toContain(projectId);
    expect((await fail(outsider.projects.get({ projectId })))?.code).toBe("NOT_FOUND");
  });

  it("superadmin reaches every project, admin only its own and joined ones", async () => {
    const { admin, adminUser, superadmin, projectId } = await setup();
    expect((await superadmin.projects.list()).map((p) => p.id)).toContain(projectId);
    expect((await superadmin.projects.get({ projectId })).id).toBe(projectId);

    expect((await admin.projects.list()).map((p) => p.id)).not.toContain(projectId);
    expect((await fail(admin.projects.get({ projectId })))?.code).toBe("NOT_FOUND");

    const own = await admin.projects.create({ name: "Admin own" });
    expect((await admin.projects.list()).map((p) => p.id)).toContain(own.id);
    // ...and a superadmin still gets into the admin's project.
    expect((await superadmin.projects.get({ projectId: own.id })).ownerId).toBe(adminUser.id);
  });

  it("archived projects vanish, even for the superadmin", async () => {
    const { owner, superadmin, projectId } = await setup();
    await owner.projects.archive({ projectId });
    expect((await fail(superadmin.projects.get({ projectId })))?.code).toBe("NOT_FOUND");
  });
});

describe("managing members", () => {
  it("lists the owner and the members", async () => {
    const { member, ownerUser, memberUser, projectId } = await setup();
    const people = await member.projectMembers.list({ projectId });
    expect(people.map((p) => `${p.kind}:${p.userId}`)).toEqual([
      `owner:${ownerUser.id}`,
      `member:${memberUser.id}`,
    ]);
    expect(people[0]).toHaveProperty("email");
  });

  it("only the owner and the superadmin can add, remove, archive, delete or transfer", async () => {
    const { member, memberUser, outsiderUser, superadmin, projectId, ownerUser } = await setup();
    const denied = async (p: Promise<unknown>) => (await fail(p))?.code;
    expect(await denied(member.projectMembers.add({ projectId, email: outsiderUser.email }))).toBe(
      "FORBIDDEN",
    );
    expect(await denied(member.projectMembers.remove({ projectId, userId: ownerUser.id }))).toBe(
      "FORBIDDEN",
    );
    expect(await denied(member.projects.archive({ projectId }))).toBe("FORBIDDEN");
    expect(await denied(member.projects.delete({ projectId, confirmName: "Team project" }))).toBe(
      "FORBIDDEN",
    );
    expect(
      await denied(member.projects.transferOwner({ projectId, newOwnerId: memberUser.id })),
    ).toBe("FORBIDDEN");

    // The superadmin may manage anyone's project.
    await superadmin.projectMembers.add({ projectId, email: outsiderUser.email });
    expect((await superadmin.projectMembers.list({ projectId })).length).toBe(3);
  });

  it("adds by email and validates the target", async () => {
    const { owner, ownerUser, memberUser, outsiderUser, projectId } = await setup();
    const add = (email: string) => fail(owner.projectMembers.add({ projectId, email }));
    expect((await add("nobody@test.local"))?.code).toBe("NOT_FOUND");
    expect((await add(ownerUser.email))?.code).toBe("CONFLICT"); // already the owner
    expect((await add(memberUser.email))?.code).toBe("CONFLICT"); // already a member
    await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, outsiderUser.id));
    expect((await add(outsiderUser.email))?.code).toBe("BAD_REQUEST");
    // Emails match regardless of case and spaces.
    const other = await createUser();
    await owner.projectMembers.add({ projectId, email: ` ${other.email.toUpperCase()} ` });
    expect((await owner.projectMembers.list({ projectId })).map((p) => p.userId)).toContain(
      other.id,
    );
  });

  it("removes a member, who then loses access; members can leave on their own", async () => {
    const { owner, member, memberUser, ownerUser, projectId } = await setup();
    expect(
      (await fail(member.projectMembers.remove({ projectId, userId: ownerUser.id })))?.code,
    ).toBe("FORBIDDEN"); // cannot remove the owner
    await member.projectMembers.remove({ projectId, userId: memberUser.id }); // leave
    expect((await fail(member.projects.get({ projectId })))?.code).toBe("NOT_FOUND");

    await owner.projectMembers.add({ projectId, email: memberUser.email });
    await owner.projectMembers.remove({ projectId, userId: memberUser.id });
    expect((await fail(member.projects.get({ projectId })))?.code).toBe("NOT_FOUND");
    expect(
      (await fail(owner.projectMembers.remove({ projectId, userId: memberUser.id })))?.code,
    ).toBe("NOT_FOUND");
    expect(
      (await fail(owner.projectMembers.remove({ projectId, userId: ownerUser.id })))?.code,
    ).toBe("BAD_REQUEST"); // the owner is not a removable member
  });
});

describe("transferring ownership", () => {
  it("makes the target the owner and keeps the previous owner as a member", async () => {
    const { owner, member, ownerUser, memberUser, projectId } = await setup();
    await owner.projects.transferOwner({ projectId, newOwnerId: memberUser.id });

    const project = await member.projects.get({ projectId });
    expect(project.ownerId).toBe(memberUser.id);
    const people = await member.projectMembers.list({ projectId });
    expect(people.map((p) => `${p.kind}:${p.userId}`)).toEqual([
      `owner:${memberUser.id}`,
      `member:${ownerUser.id}`,
    ]);
    // The old owner keeps access but lost the owner-only rights.
    expect((await owner.projects.get({ projectId })).id).toBe(projectId);
    expect((await fail(owner.projects.archive({ projectId })))?.code).toBe("FORBIDDEN");
    // The new owner has them.
    await member.projects.archive({ projectId });
  });

  it("works for a non-member target and for the superadmin", async () => {
    const { superadmin, outsiderUser, ownerUser, projectId } = await setup();
    await superadmin.projects.transferOwner({ projectId, newOwnerId: outsiderUser.id });
    const rows = await db
      .select()
      .from(schema.projectMember)
      .where(eq(schema.projectMember.projectId, projectId));
    expect(rows.map((r) => r.userId)).toContain(ownerUser.id);
    expect(rows.map((r) => r.userId)).not.toContain(outsiderUser.id); // owner is implicit
  });

  it("rejects unknown, blocked and same-owner targets", async () => {
    const { owner, ownerUser, outsiderUser, projectId } = await setup();
    const move = (newOwnerId: string) =>
      fail(owner.projects.transferOwner({ projectId, newOwnerId }));
    expect((await move("missing"))?.code).toBe("NOT_FOUND");
    expect((await move(ownerUser.id))?.code).toBe("BAD_REQUEST");
    await db.update(schema.user).set({ banned: true }).where(eq(schema.user.id, outsiderUser.id));
    expect((await move(outsiderUser.id))?.code).toBe("BAD_REQUEST");
  });

  it("frees the previous owner from the 'owns projects' deletion block", async () => {
    const { owner, ownerUser, memberUser, projectId } = await setup();
    expect(await usersRepository.countOwnedProjects(ownerUser.id)).toBe(1);
    await owner.projects.transferOwner({ projectId, newOwnerId: memberUser.id });
    expect(await usersRepository.countOwnedProjects(ownerUser.id)).toBe(0);
    expect(await usersRepository.countOwnedProjects(memberUser.id)).toBe(1);
  });
});

describe("membership housekeeping", () => {
  it("drops memberships when the user or the project is deleted", async () => {
    const { owner, memberUser, projectId } = await setup();
    const total = async (where: ReturnType<typeof eq>) =>
      (await db.select({ n: count() }).from(schema.projectMember).where(where))[0]?.n ?? 0;

    await db.delete(schema.user).where(eq(schema.user.id, memberUser.id));
    expect(await total(eq(schema.projectMember.projectId, projectId))).toBe(0);

    const another = await createUser();
    await owner.projectMembers.add({ projectId, email: another.email });
    await owner.projects.delete({ projectId, confirmName: "Team project" });
    expect(await total(eq(schema.projectMember.projectId, projectId))).toBe(0);
  });

  it("writes audit entries", async () => {
    const { owner, outsiderUser, memberUser, projectId } = await setup();
    await owner.projectMembers.add({ projectId, email: outsiderUser.email });
    await owner.projectMembers.remove({ projectId, userId: outsiderUser.id });
    await owner.projects.transferOwner({ projectId, newOwnerId: memberUser.id });
    const actions = (
      await db.select().from(schema.auditLog).where(eq(schema.auditLog.targetId, projectId))
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "project.member_added",
        "project.member_removed",
        "project.owner_changed",
      ]),
    );
  });
});
