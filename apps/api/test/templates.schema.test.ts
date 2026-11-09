import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { createUser } from "./factories";

const failure = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: unknown) => String((e as Error).cause ?? e),
  );

async function setup() {
  const u = await createUser();
  const mk = async () => {
    const id = crypto.randomUUID();
    await db.insert(schema.project).values({ id, name: "P", slug: id, ownerId: u.id });
    return id;
  };
  return { mk };
}

const tpl = (projectId: string, slug: string) => ({
  id: crypto.randomUUID(),
  projectId,
  slug,
  name: "T",
});
const ver = (templateId: string, number: number, status: "draft" | "published") => ({
  id: crypto.randomUUID(),
  templateId,
  number,
  status,
  source: "x",
  schema: { type: "object", properties: {} },
  sampleData: {},
});

describe("template tables", () => {
  it("scopes slug uniqueness to the project", async () => {
    const { mk } = await setup();
    const [p1, p2] = [await mk(), await mk()];
    await db.insert(schema.template).values(tpl(p1, "invoice"));
    expect(await failure(db.insert(schema.template).values(tpl(p1, "invoice")))).toMatch(/UNIQUE/);
    await db.insert(schema.template).values(tpl(p2, "invoice"));
  });

  it("allows one draft per template and unique version numbers", async () => {
    const { mk } = await setup();
    const t = tpl(await mk(), "a");
    await db.insert(schema.template).values(t);
    await db.insert(schema.templateVersion).values(ver(t.id, 1, "draft"));
    expect(await failure(db.insert(schema.templateVersion).values(ver(t.id, 2, "draft")))).toMatch(
      /UNIQUE/,
    );
    expect(
      await failure(db.insert(schema.templateVersion).values(ver(t.id, 1, "published"))),
    ).toMatch(/UNIQUE/);
    await db.insert(schema.templateVersion).values(ver(t.id, 2, "published"));
  });
});
