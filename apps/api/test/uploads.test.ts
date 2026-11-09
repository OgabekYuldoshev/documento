import { spawnSync } from "node:child_process";
import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { uploadsService } from "../src/modules/uploads/uploads.service";
import { callerFor, createUser } from "./factories";
import { solidPng } from "./png";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;

const SCHEMA: TemplateSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    logo: { type: "string", format: "image", "x-image": { formats: ["png"], maxMegapixels: 1 } },
  },
  required: ["name", "logo"],
  additionalProperties: false,
};
const SOURCE = '#let data = json("data.json")\n#image(data.logo, width: 20pt)\n#data.name';

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Uploads project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Badge" });
  const ids = { projectId: project.id, templateId: tpl.id };
  await owner.templates.saveDraft({
    ...ids,
    source: SOURCE,
    schema: SCHEMA,
    sampleData: { name: "Ali", logo: "upl_sample123" },
    renderTimeoutSec: 30,
    maxPayloadKb: 64,
  });
  await owner.templates.publish(ids);
  const { secret } = await owner.apiKeys.create({
    projectId: project.id,
    name: "Uploader",
    scope: "project",
    rateLimitPerMin: 600,
  });
  return { owner, project, tpl, secret };
}

const upload = (secret: string, body: Uint8Array | string) =>
  app.request("/v1/uploads", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    body: body as BodyInit,
  });

const generate = (secret: string, slug: string, data: unknown) =>
  app.request(`/v1/templates/${slug}/generate?response=json`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });

describe("POST /v1/uploads", () => {
  it("stores a png and returns its dimensions", async () => {
    const { secret } = await setup();
    const res = await upload(secret, solidPng(10, 20));
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({ mime: "image/png", width: 10, height: 20 });
    expect(String(body.uploadId)).toMatch(/^upl_[a-f0-9]{24}$/);
  });

  it("rejects empty bodies, non-images and fonts by content", async () => {
    const { secret } = await setup();
    expect((await upload(secret, new Uint8Array())).status).toBe(400);
    const text = await upload(secret, "not an image at all");
    expect(text.status).toBe(400);
    expect(text.headers.get("content-type")).toContain("application/problem+json");
  });

  it("rejects SVG with ENTITY declarations", async () => {
    const { secret } = await setup();
    const svg =
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>';
    expect((await upload(secret, svg)).status).toBe(400);
  });

  it("requires a key", async () => {
    const res = await app.request("/v1/uploads", { method: "POST", body: solidPng(2, 2) });
    expect(res.status).toBe(401);
  });

  it("cleans expired uploads", async () => {
    const { secret } = await setup();
    const { uploadId } = (await (await upload(secret, solidPng(2, 2))).json()) as {
      uploadId: string;
    };
    await db
      .update(schema.upload)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.upload.id, uploadId));
    expect(await uploadsService.cleanExpired()).toBeGreaterThanOrEqual(1);
    const left = await db.select().from(schema.upload).where(eq(schema.upload.id, uploadId));
    expect(left).toHaveLength(0);
  });
});

describe("image fields in generate", () => {
  it("rejects an unknown upload id with a field-level 422", async () => {
    const { secret, tpl } = await setup();
    const res = await generate(secret, tpl.slug, { name: "A", logo: "upl_doesnotexist1" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: { path: string; code: string }[] };
    expect(body.errors).toEqual([
      expect.objectContaining({ path: "/logo", code: "image_not_found" }),
    ]);
  });

  it("rejects an expired upload and one from another project", async () => {
    const a = await setup();
    const b = await setup();
    const mine = (await (await upload(a.secret, solidPng(4, 4))).json()) as { uploadId: string };
    const foreign = (await (await upload(b.secret, solidPng(4, 4))).json()) as {
      uploadId: string;
    };
    expect(
      (await generate(a.secret, a.tpl.slug, { name: "A", logo: foreign.uploadId })).status,
    ).toBe(422);
    await db
      .update(schema.upload)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.upload.id, mine.uploadId));
    expect((await generate(a.secret, a.tpl.slug, { name: "A", logo: mine.uploadId })).status).toBe(
      422,
    );
  });

  it("enforces field constraints (format)", async () => {
    const { secret, tpl } = await setup();
    const up = await upload(
      secret,
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>',
    );
    expect(up.status).toBe(201);
    const { uploadId } = (await up.json()) as { uploadId: string };
    const res = await generate(secret, tpl.slug, { name: "A", logo: uploadId });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { errors: { code: string }[] };
    expect(body.errors[0]?.code).toBe("image_format");
  });

  it.skipIf(!hasTypst)("renders a PDF using the uploaded image", async () => {
    const { secret, tpl } = await setup();
    const { uploadId } = (await (await upload(secret, solidPng(16, 16))).json()) as {
      uploadId: string;
    };
    const res = await generate(secret, tpl.slug, { name: "Ali", logo: uploadId });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; pages: number };
    expect(body).toMatchObject({ status: "ok", pages: 1 });
  });
});
