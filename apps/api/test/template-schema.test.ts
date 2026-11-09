import {
  diffSchemas,
  type FieldDef,
  sampleFromSchema,
  type TemplateSchema,
  templateSchemaSchema,
  toJsonSchema,
} from "@documento/shared";
import { describe, expect, it } from "vitest";

const parse = (fields: FieldDef[]) => templateSchemaSchema.safeParse({ fields });
const str = (name: string, extra: object = {}): FieldDef =>
  ({ name, type: "string", ...extra }) as FieldDef;

describe("template schema DSL", () => {
  it("compiles to strict JSON Schema", () => {
    const schema: TemplateSchema = {
      fields: [
        str("name", { required: true, maxLength: 50 }),
        { name: "born", type: "date" },
        { name: "photo", type: "image" },
        {
          name: "items",
          type: "array",
          items: { name: "item", type: "object", fields: [str("sku", { required: true })] },
        },
      ],
    };
    expect(parse(schema.fields).success).toBe(true);
    type Js = {
      additionalProperties: boolean;
      required: string[];
      properties: Record<
        string,
        Record<string, unknown> & { items?: { additionalProperties: boolean } }
      >;
    };
    const js = toJsonSchema(schema) as unknown as Js;
    expect(js.additionalProperties).toBe(false);
    expect(js.required).toEqual(["name"]);
    expect(js.properties.born).toEqual({ type: "string", format: "date" });
    expect(String(js.properties.photo?.pattern)).toMatch(/^\^upl_/);
    expect(js.properties.items?.items?.additionalProperties).toBe(false);
  });

  it.each([
    ["nested quantifier", str("a", { pattern: "(a+)+$" })],
    ["long pattern", str("a", { pattern: "a".repeat(201) })],
    ["invalid regex", str("a", { pattern: "[" })],
    ["backreference", str("a", { pattern: "(a)\\1" })],
    ["__proto__ name", str("__proto__")],
    ["bad name", str("1abc")],
    ["min > max", str("a", { minLength: 5, maxLength: 2 })],
  ])("rejects %s", (_, field) => {
    expect(parse([field]).success).toBe(false);
  });

  it("rejects duplicate names, depth 6 and 201 fields", () => {
    expect(parse([str("a"), str("a")]).success).toBe(false);
    let deep: FieldDef = str("leaf");
    for (let i = 0; i < 5; i++) deep = { name: `o${i}`, type: "object", fields: [deep] };
    expect(parse([deep]).success).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => str(`f${i}`));
    expect(parse(many).success).toBe(false);
  });

  it("accepts a safe pattern and unknown keys are rejected", () => {
    expect(parse([str("a", { pattern: "^[A-Z]{2}\\d{4}$" })]).success).toBe(true);
    expect(parse([{ ...str("a"), evil: 1 } as FieldDef]).success).toBe(false);
  });

  it("samples every field with the right type", () => {
    const fields: FieldDef[] = [
      str("s", { format: "email" }),
      { name: "n", type: "number", minimum: 5 },
      { name: "b", type: "boolean" },
      { name: "e", type: "enum", values: ["x", "y"] },
      { name: "arr", type: "array", items: { name: "item", type: "integer" } },
    ];
    expect(sampleFromSchema({ fields })).toEqual({
      s: "user@example.com",
      n: 5,
      b: false,
      e: "x",
      arr: [0],
    });
  });

  it("reports breaking changes only", () => {
    const prev: TemplateSchema = {
      fields: [str("a", { required: true }), str("b"), { name: "c", type: "number" }],
    };
    const next: TemplateSchema = {
      fields: [
        str("b", { required: true }),
        { name: "c", type: "string" },
        str("d", { required: true }),
        str("opt"),
      ],
    };
    const kinds = diffSchemas(prev, next)
      .map((x) => `${x.kind}:${x.path}`)
      .sort();
    expect(kinds).toEqual([
      "removed:/a",
      "required_added:/b",
      "required_added:/d",
      "type_changed:/c",
    ]);
    expect(diffSchemas(prev, { fields: [...prev.fields, str("extra")] })).toEqual([]);
  });
});

describe("image references", () => {
  const schema: TemplateSchema = {
    fields: [
      { name: "photo", type: "image" },
      {
        name: "pages",
        type: "array",
        items: { name: "item", type: "object", fields: [{ name: "scan", type: "image" }] },
      },
      { name: "meta", type: "object", fields: [{ name: "stamp", type: "image" }] },
    ],
  };
  const data = {
    photo: "upl_a1b2c3",
    pages: [{ scan: "upl_p1xxxx" }, { scan: "upl_p2xxxx" }],
    meta: { stamp: "upl_s1xxxx" },
  };

  it("collects ids with JSON-pointer paths", async () => {
    const { collectImages } = await import("@documento/shared");
    expect(collectImages(schema, data).map((r) => `${r.path}=${r.id}`)).toEqual([
      "/photo=upl_a1b2c3",
      "/pages/0/scan=upl_p1xxxx",
      "/pages/1/scan=upl_p2xxxx",
      "/meta/stamp=upl_s1xxxx",
    ]);
  });

  it("replaces ids in a copy and leaves the input untouched", async () => {
    const { transformImages } = await import("@documento/shared");
    const out = transformImages(schema, data, (r) => `uploads/${r.id}.png`);
    expect(out.data).toMatchObject({
      photo: "uploads/upl_a1b2c3.png",
      pages: [{ scan: "uploads/upl_p1xxxx.png" }, { scan: "uploads/upl_p2xxxx.png" }],
    });
    expect(data.photo).toBe("upl_a1b2c3");
    expect(transformImages(schema, { photo: 5 }, () => "x").refs).toEqual([]);
  });
});
