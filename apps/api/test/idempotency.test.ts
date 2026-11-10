import { createHash } from "node:crypto";
import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { generationsRepository } from "../src/modules/generations/generations.repository";
import { generationsService } from "../src/modules/generations/generations.service";
import { callerFor, createUser } from "./factories";

const SCHEMA: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" }, age: { type: "integer" } },
  required: ["name"],
  additionalProperties: false,
};

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Idem project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Idem tpl" });
  const ids = { projectId: project.id, templateId: tpl.id };
  await owner.templates.saveDraft({
    ...ids,
    source: '#let data = json("data.json")',
    schema: SCHEMA,
    sampleData: { name: "Ali" },
    renderTimeoutSec: 30,
    maxPayloadKb: 64,
  });
  await owner.templates.publish(ids);
  const [row] = await db.select().from(schema.project).where(eq(schema.project.id, project.id));
  if (!row) throw new Error("no project");
  const apiKeyId = crypto.randomUUID();
  // Invalid data always ends as `validation_error` at once, so no Typst or queue is involved.
  const send = (
    key: string,
    data: Record<string, unknown>,
    versionNumber?: number,
    templateId = ids.templateId,
  ) =>
    generationsService.create({ source: "api", apiKeyId, idempotencyKey: key }, row, {
      templateId,
      data,
      versionNumber,
    });
  return { send, apiKeyId };
}

const fail = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code: string }) => e,
  );

describe("idempotency", () => {
  it("treats the same data with a different key order as the same request", async () => {
    const { send } = await setup();
    const a = await send("k1", { name: 1, age: "x" });
    const b = await send("k1", { age: "x", name: 1 });
    expect(b.id).toBe(a.id);
  });

  it("rejects the same key with other data", async () => {
    const { send } = await setup();
    await send("k1", { name: 1 });
    expect((await fail(send("k1", { name: 2 })))?.code).toBe("CONFLICT");
  });

  it("rejects the same key with another template version", async () => {
    const { send } = await setup();
    await send("k1", { name: 1 }, 1);
    expect((await fail(send("k1", { name: 1 }, 2)))?.code).toBe("CONFLICT");
    expect((await send("k1", { name: 1 }, 1)).templateVersionId).toBeTruthy();
  });

  it("still accepts rows stored with the old (non-canonical) hash", async () => {
    const { send, apiKeyId } = await setup();
    const first = await send("legacy", { name: 1, age: "x" });
    const legacy = createHash("sha256")
      .update(JSON.stringify({ name: 1, age: "x" }))
      .digest("hex");
    await db
      .update(schema.generation)
      .set({ inputSha256: legacy })
      .where(eq(schema.generation.id, first.id));
    expect((await send("legacy", { name: 1, age: "x" })).id).toBe(first.id);
    expect(await generationsRepository.findByIdempotency(apiKeyId, "legacy")).not.toBeNull();
  });

  it("forgets a key after the idempotency window so it can be used again", async () => {
    const { send, apiKeyId } = await setup();
    const old = await send("k1", { name: 1 });
    const aged = new Date(Date.now() - (env.IDEMPOTENCY_TTL_HOURS + 1) * 3_600_000);
    await db
      .update(schema.generation)
      .set({ queuedAt: aged })
      .where(eq(schema.generation.id, old.id));

    const fresh = await send("k1", { name: 2 }); // other data, but the old key is expired
    expect(fresh.id).not.toBe(old.id);
    expect((await generationsRepository.find(old.id))?.idempotencyKey).toBeNull();
    expect((await generationsRepository.findByIdempotency(apiKeyId, "k1"))?.id).toBe(fresh.id);
  });
});
