import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { apiKeysService } from "../src/modules/api-keys/api-keys.service";
import { generateKey, hashMatches, parseKeyPrefix } from "../src/modules/api-keys/key-format";
import { callerFor, createUser } from "./factories";

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string; message: string }) => e,
  );

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Keys project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Keys tpl" });
  return { owner, projectId: project.id, templateId: tpl.id };
}

describe("key format", () => {
  it("generates parseable keys whose hash matches only the right secret", () => {
    const a = generateKey();
    const b = generateKey();
    expect(a.raw).toMatch(/^dk_live_[0-9a-f]{8}_[0-9a-f]{48}$/);
    expect(parseKeyPrefix(a.raw)).toBe(a.prefix);
    expect(hashMatches(a.raw, a.hash)).toBe(true);
    expect(hashMatches(b.raw, a.hash)).toBe(false);
  });

  it.each([
    "",
    "dk_live_",
    `dk_test_12345678_${"a".repeat(48)}`,
    `dk_live_1234567g_${"a".repeat(48)}`,
    `dk_live_12345678_${"a".repeat(47)}`,
  ])("rejects malformed key %j", (raw) => {
    expect(parseKeyPrefix(raw)).toBeNull();
  });
});

describe("apiKeys", () => {
  it("returns the secret once and never stores it", async () => {
    const { owner, projectId } = await setup();
    const { key, secret } = await owner.apiKeys.create({
      projectId,
      name: "Prod",
      scope: "project",
    });
    expect(secret).toMatch(/^dk_live_/);
    expect(key).not.toHaveProperty("hash");
    const rows = await db.select().from(schema.apiKey);
    expect(JSON.stringify(rows)).not.toContain(secret);
    const listed = await owner.apiKeys.list({ projectId });
    expect(listed[0]).toMatchObject({ id: key.id, prefix: key.prefix, rateLimitPerMin: 60 });
    expect(JSON.stringify(listed)).not.toContain(secret);
  });

  it("authenticates, and rejects wrong, revoked and expired keys", async () => {
    const { owner, projectId } = await setup();
    const { key, secret } = await owner.apiKeys.create({
      projectId,
      name: "Key one",
      scope: "project",
    });
    expect((await apiKeysService.authenticate(secret)).ok).toBe(true);
    expect(await apiKeysService.authenticate(null)).toEqual({ ok: false, reason: "missing" });
    const forged = `dk_live_${key.prefix}_${"0".repeat(48)}`;
    expect(await apiKeysService.authenticate(forged)).toEqual({ ok: false, reason: "invalid" });
    expect(await apiKeysService.authenticate("garbage")).toEqual({ ok: false, reason: "invalid" });

    await owner.apiKeys.revoke({ projectId, apiKeyId: key.id });
    expect(await apiKeysService.authenticate(secret)).toEqual({ ok: false, reason: "revoked" });

    const second = await owner.apiKeys.create({
      projectId,
      name: "Key exp",
      scope: "project",
      expiresInDays: 1,
    });
    await db.update(schema.apiKey).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await apiKeysService.authenticate(second.secret)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a key whose project was archived", async () => {
    const { owner, projectId } = await setup();
    const { secret } = await owner.apiKeys.create({ projectId, name: "Key one", scope: "project" });
    await owner.projects.archive({ projectId });
    expect(await apiKeysService.authenticate(secret)).toEqual({ ok: false, reason: "invalid" });
  });

  it("validates template scope", async () => {
    const { owner, projectId, templateId } = await setup();
    expect(
      (await fail(owner.apiKeys.create({ projectId, name: "Key tpl", scope: "templates" })))?.code,
    ).toBe("BAD_REQUEST");
    const other = callerFor(await createUser());
    const otherProject = await other.projects.create({ name: "Other keys project" });
    const otherTpl = await other.templates.create({ projectId: otherProject.id, name: "Foreign" });
    const foreign = await fail(
      owner.apiKeys.create({
        projectId,
        name: "Key tpl",
        scope: "templates",
        allowedTemplateIds: [otherTpl.id],
      }),
    );
    expect(foreign?.code).toBe("BAD_REQUEST");
    const { key, secret } = await owner.apiKeys.create({
      projectId,
      name: "Key tpl",
      scope: "templates",
      allowedTemplateIds: [templateId],
    });
    const auth = await apiKeysService.authenticate(secret);
    if (!auth.ok) throw new Error("auth failed");
    expect(apiKeysService.canUseTemplate(auth.key, templateId)).toBe(true);
    expect(apiKeysService.canUseTemplate(auth.key, "other")).toBe(false);
    expect(key.allowedTemplateIds).toEqual([templateId]);
  });

  it("bounds rate limit and hides keys from other users", async () => {
    const { owner, projectId } = await setup();
    expect(
      (
        await fail(
          owner.apiKeys.create({
            projectId,
            name: "Key rate",
            scope: "project",
            rateLimitPerMin: 0,
          }),
        )
      )?.code,
    ).toBe("BAD_REQUEST");
    expect(
      (
        await fail(
          owner.apiKeys.create({
            projectId,
            name: "Key rate",
            scope: "project",
            rateLimitPerMin: 100000,
          }),
        )
      )?.code,
    ).toBe("BAD_REQUEST");
    const intruder = callerFor(await createUser());
    expect((await fail(intruder.apiKeys.list({ projectId })))?.code).toBe("NOT_FOUND");
  });
});
