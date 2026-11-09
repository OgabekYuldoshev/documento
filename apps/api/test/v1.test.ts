import { spawnSync } from "node:child_process";
import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { callerFor, createUser } from "./factories";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;
const SCHEMA: TemplateSchema = {
  fields: [
    { name: "name", type: "string", required: true },
    { name: "age", type: "integer", minimum: 0 },
  ],
};
const SOURCE = '#let data = json("data.json")\nSalom, #data.name!';

async function setup(opts: { maxPayloadKb?: number; rate?: number; publish?: boolean } = {}) {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "V1 project" });
  const mk = async (name: string, publish = true) => {
    const tpl = await owner.templates.create({ projectId: project.id, name });
    const ids = { projectId: project.id, templateId: tpl.id };
    if (publish) {
      await owner.templates.saveDraft({
        ...ids,
        source: SOURCE,
        schema: SCHEMA,
        sampleData: { name: "Ali" },
        renderTimeoutSec: 30,
        maxPayloadKb: opts.maxPayloadKb ?? 64,
      });
      await owner.templates.publish(ids);
    }
    return { ...ids, slug: tpl.slug };
  };
  const invoice = await mk("Invoice", opts.publish !== false);
  const { secret, key } = await owner.apiKeys.create({
    projectId: project.id,
    name: "Integration",
    scope: "project",
    rateLimitPerMin: opts.rate ?? 60,
  });
  return { owner, project, invoice, mk, secret, key };
}

const call = (secret: string | null, path: string, init: RequestInit = {}) =>
  app.request(`/v1${path}`, {
    ...init,
    headers: { ...(secret ? { Authorization: `Bearer ${secret}` } : {}), ...(init.headers ?? {}) },
  });

const post = (
  secret: string,
  slug: string,
  body: unknown,
  headers: Record<string, string> = {},
  q = "",
) =>
  call(secret, `/templates/${slug}/generate${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("/v1 authentication and limits", () => {
  it("rejects missing, malformed and revoked keys with problem+json", async () => {
    const { owner, project, key, secret } = await setup();
    for (const s of [null, "garbage", `dk_live_${key.prefix}_${"0".repeat(48)}`]) {
      const res = await call(s, "/templates");
      expect(res.status).toBe(401);
      expect(res.headers.get("content-type")).toContain("application/problem+json");
      expect(res.headers.get("www-authenticate")).toContain("Bearer");
    }
    expect((await call(secret, "/templates")).status).toBe(200);
    expect((await app.request("/v1/templates", { headers: { "x-api-key": secret } })).status).toBe(
      200,
    );
    await owner.apiKeys.revoke({ projectId: project.id, apiKeyId: key.id });
    expect((await call(secret, "/templates")).status).toBe(401);
  });

  it("rate limits per key with Retry-After", async () => {
    const { secret } = await setup({ rate: 2 });
    const codes: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 3; i++) {
      last = await call(secret, "/templates");
      codes.push(last.status);
    }
    expect(codes).toEqual([200, 200, 429]);
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(last?.headers.get("ratelimit-limit")).toBe("2");
  });

  it("scopes keys to templates and never leaks other projects", async () => {
    const { owner, project, invoice, mk } = await setup();
    const other = await mk("Contract");
    const scoped = await owner.apiKeys.create({
      projectId: project.id,
      name: "Scoped",
      scope: "templates",
      allowedTemplateIds: [invoice.templateId],
    });
    const list = (await (await call(scoped.secret, "/templates")).json()) as {
      data: { slug: string }[];
    };
    expect(list.data.map((t) => t.slug)).toEqual([invoice.slug]);
    expect((await call(scoped.secret, `/templates/${other.slug}`)).status).toBe(403);
    expect((await post(scoped.secret, other.slug, { data: { name: "x" } })).status).toBe(403);
    expect((await call(scoped.secret, "/templates/nope")).status).toBe(404);

    const stranger = await setup();
    expect((await call(stranger.secret, `/templates/${other.slug}`)).status).toBe(404);
  });
});

describe("/v1 generate validation", () => {
  it("returns 409 for unpublished, 400 for bad bodies, 413 for big payloads", async () => {
    const draft = await setup({ publish: false });
    expect((await post(draft.secret, draft.invoice.slug, { data: { name: "x" } })).status).toBe(
      409,
    );

    const { secret, invoice } = await setup({ maxPayloadKb: 1 });
    expect((await post(secret, invoice.slug, "{not json")).status).toBe(400);
    expect((await post(secret, invoice.slug, { data: [] })).status).toBe(400);
    expect((await post(secret, invoice.slug, { nodata: 1 })).status).toBe(400);
    expect(
      (await post(secret, invoice.slug, { data: { name: "x" } }, {}, "?version=abc")).status,
    ).toBe(400);
    const big = await post(secret, invoice.slug, { data: { name: "x".repeat(2000) } });
    expect(big.status).toBe(413);
  });

  it("returns 422 with JSON-pointer errors and never stores the input", async () => {
    const { secret, invoice } = await setup();
    const res = await post(secret, invoice.slug, { data: { age: -1, extra: "SECRETVALUE" } });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      type: string;
      errors: { path: string; code: string }[];
      id: string;
    };
    expect(body.type).toBe("validation_error");
    expect(body.errors.map((e) => `${e.path}:${e.code}`).sort()).toEqual([
      "/age:minimum",
      "/extra:unknown_field",
      "/name:required",
    ]);
    const [row] = await db
      .select()
      .from(schema.generation)
      .where(eq(schema.generation.id, body.id));
    expect(row?.source).toBe("api");
    expect(JSON.stringify(row)).not.toContain("SECRETVALUE");
  });

  it("answers 404 for another key's documents", async () => {
    const a = await setup();
    const b = await setup();
    const res = await post(a.secret, a.invoice.slug, { data: {} });
    const { id } = (await res.json()) as { id: string };
    expect((await call(a.secret, `/documents/${id}`)).status).toBe(200);
    expect((await call(b.secret, `/documents/${id}`)).status).toBe(404);
    expect((await call(b.secret, `/documents/${id}/file`)).status).toBe(404);
  });

  it("serves OpenAPI limited to the key's templates", async () => {
    const { secret, invoice } = await setup();
    const doc = (await (await call(secret, "/openapi.json")).json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toContain(`/v1/templates/${invoice.slug}/generate`);
  });
});

describe.skipIf(!hasTypst)("/v1 generate with Typst", () => {
  it("returns the PDF synchronously, or JSON metadata", async () => {
    const { secret, invoice } = await setup();
    const res = await post(secret, invoice.slug, { data: { name: "Ali" } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("x-document-id")).toBeTruthy();
    expect(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");

    const json = await post(secret, invoice.slug, { data: { name: "Ali" } }, {}, "?response=json");
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({ status: "ok", pages: 1 });
  });

  it("supports async mode, polling and download", async () => {
    const { secret, invoice } = await setup();
    const res = await post(
      secret,
      invoice.slug,
      { data: { name: "Ali" } },
      { Prefer: "respond-async" },
    );
    expect(res.status).toBe(202);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^\/v1\/documents\//);
    let status = "";
    for (let i = 0; i < 100 && status !== "ok"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      status = (
        (await (
          await app.request(location, { headers: { Authorization: `Bearer ${secret}` } })
        ).json()) as { status: string }
      ).status;
    }
    expect(status).toBe("ok");
    const file = await app.request(`${location}/file`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(file.status).toBe(200);
  });

  it("replays idempotent requests and rejects key reuse with other data", async () => {
    const { secret, invoice } = await setup();
    const h = { "Idempotency-Key": "order-1" };
    const first = await post(secret, invoice.slug, { data: { name: "Ali" } }, h);
    const second = await post(secret, invoice.slug, { data: { name: "Ali" } }, h);
    expect(second.headers.get("x-document-id")).toBe(first.headers.get("x-document-id"));
    const clash = await post(secret, invoice.slug, { data: { name: "Vali" } }, h);
    expect(clash.status).toBe(409);
    const rows = await db
      .select()
      .from(schema.generation)
      .where(eq(schema.generation.idempotencyKey, "order-1"));
    expect(rows).toHaveLength(1);
  });

  it("reports 410 after the PDF expired", async () => {
    const { secret, invoice } = await setup();
    const res = await post(secret, invoice.slug, { data: { name: "Ali" } });
    const id = res.headers.get("x-document-id") ?? "";
    await db
      .update(schema.generation)
      .set({ pdfExpiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.generation.id, id));
    expect((await call(secret, `/documents/${id}/file`)).status).toBe(410);
    expect(
      ((await (await call(secret, `/documents/${id}`)).json()) as { status: string }).status,
    ).toBe("expired");
  });
});
