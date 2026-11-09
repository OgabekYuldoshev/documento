import {
  collectImages,
  diffSchemas,
  sampleFromSchema,
  type TemplateSchema,
  templateSchemaSchema,
  transformImages,
} from "@documento/shared";
import { describe, expect, it } from "vitest";
import { assertSchemaCompiles, validateData } from "../src/modules/templates/validate-data";

const obj = (properties: Record<string, unknown>, required: string[] = []): TemplateSchema => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
});
const ok = (schema: TemplateSchema) => templateSchemaSchema.safeParse(schema).success;
const str = (extra: object = {}) => ({ type: "string", ...extra });

describe("template JSON Schema rules", () => {
  it("accepts a normal schema", () => {
    expect(
      ok(
        obj(
          { name: str({ maxLength: 50 }), born: str({ format: "date" }), tags: { type: "array" } },
          ["name"],
        ),
      ),
    ).toBe(true);
  });

  it.each([
    ["nested quantifier", obj({ a: str({ pattern: "(a+)+$" }) })],
    ["long pattern", obj({ a: str({ pattern: "a".repeat(201) }) })],
    ["invalid regex", obj({ a: str({ pattern: "[" }) })],
    ["backreference", obj({ a: str({ pattern: "(a)\\1" }) })],
    [
      "__proto__ name",
      JSON.parse('{"type":"object","properties":{"__proto__":{"type":"string"}}}'),
    ],
    ["bad name", obj({ "1abc": str() })],
    ["$ref", obj({ a: { $ref: "#/definitions/x" } })],
    ["non-object root", { type: "array" }],
    ["other draft", { ...obj({}), $schema: "https://json-schema.org/draft/2020-12/schema" }],
  ])("rejects %s", (_, schema) => {
    expect(ok(schema as TemplateSchema)).toBe(false);
  });

  it("rejects depth 6 and 201 fields", () => {
    let deep: TemplateSchema = obj({ leaf: str() });
    for (let i = 0; i < 5; i++) deep = obj({ [`o${i}`]: deep });
    expect(ok(deep)).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`f${i}`, str()]));
    expect(ok(obj(many))).toBe(false);
  });
});

describe("Ajv strict + ajv-formats", () => {
  it("rejects schemas Ajv cannot compile", () => {
    expect(() => assertSchemaCompiles(obj({ a: { type: "strng" } }))).toThrow();
    expect(() => assertSchemaCompiles(obj({ a: str({ format: "nope" }) }))).toThrow();
    expect(() => assertSchemaCompiles(obj({ a: str({ typo: 1 }) }))).toThrow();
  });

  it.each([
    ["email", "a@b.co", "a@"],
    ["uuid", "123e4567-e89b-12d3-a456-426614174000", "123"],
    ["uri", "https://example.com/x", "not a uri"],
    ["hostname", "example.com", "-bad-"],
    ["ipv4", "192.168.0.1", "999.1.1.1"],
    ["ipv6", "2001:db8::1", "zzz"],
    ["date", "2024-02-29", "2023-02-29"],
    ["time", "09:30:00Z", "25:00:00Z"],
    ["date-time", "2024-01-31T09:00:00Z", "2024-01-31"],
    ["duration", "P1DT2H", "1 day"],
    ["json-pointer", "/a/b", "a/b"],
    ["image", "upl_abc123", "../etc/passwd"],
  ])("format %s", (format, good, bad) => {
    const schema = obj({ v: str({ format }) });
    expect(validateData(schema, { v: good }).ok).toBe(true);
    const r = validateData(schema, { v: bad });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ path: "/v", code: "format" });
  });

  it("supports union types, oneOf and const", () => {
    const schema = obj({
      n: { type: ["string", "null"] },
      k: { oneOf: [{ const: "a" }, { const: "b" }] },
    });
    expect(validateData(schema, { n: null, k: "a" }).ok).toBe(true);
    expect(validateData(schema, { n: 1, k: "c" }).ok).toBe(false);
  });
});

describe("samples and diff", () => {
  it("samples every field with the right type", () => {
    const schema = obj({
      s: str({ format: "email" }),
      n: { type: "number", minimum: 5 },
      b: { type: "boolean" },
      e: { enum: ["x", "y"] },
      arr: { type: "array", items: { type: "integer" } },
      d: str({ format: "date" }),
    });
    expect(sampleFromSchema(schema)).toEqual({
      s: "user@example.com",
      n: 5,
      b: false,
      e: "x",
      arr: [0],
      d: "2024-01-31",
    });
    expect(validateData(schema, sampleFromSchema(schema)).ok).toBe(true);
  });

  it("reports breaking changes only", () => {
    const prev = obj({ a: str(), b: str(), c: { type: "number" } }, ["a"]);
    const next = obj({ b: str(), c: str(), d: str(), opt: str() }, ["b", "d"]);
    const kinds = diffSchemas(prev, next)
      .map((x) => `${x.kind}:${x.path}`)
      .sort();
    expect(kinds).toEqual([
      "removed:/a",
      "required_added:/b",
      "required_added:/d",
      "type_changed:/c",
    ]);
    expect(diffSchemas(prev, obj({ ...(prev.properties as object), extra: str() }, ["a"]))).toEqual(
      [],
    );
  });
});

describe("image references", () => {
  const image = { type: "string", format: "image" };
  const schema = obj({
    photo: image,
    pages: { type: "array", items: obj({ scan: image }) },
    meta: obj({ stamp: { ...image, "x-image": { formats: ["png"] } } }),
  });
  const data = {
    photo: "upl_a1b2c3",
    pages: [{ scan: "upl_p1xxxx" }, { scan: "upl_p2xxxx" }],
    meta: { stamp: "upl_s1xxxx" },
  };

  it("collects ids with JSON-pointer paths and field constraints", () => {
    const refs = collectImages(schema, data);
    expect(refs.map((r) => `${r.path}=${r.id}`)).toEqual([
      "/photo=upl_a1b2c3",
      "/pages/0/scan=upl_p1xxxx",
      "/pages/1/scan=upl_p2xxxx",
      "/meta/stamp=upl_s1xxxx",
    ]);
    expect(refs[3]?.field).toEqual({ formats: ["png"] });
  });

  it("replaces ids in a copy and leaves the input untouched", () => {
    const out = transformImages(schema, data, (r) => `uploads/${r.id}.png`);
    expect(out.data).toMatchObject({
      photo: "uploads/upl_a1b2c3.png",
      pages: [{ scan: "uploads/upl_p1xxxx.png" }, { scan: "uploads/upl_p2xxxx.png" }],
    });
    expect(data.photo).toBe("upl_a1b2c3");
    expect(transformImages(schema, { photo: 5 }, () => "x").refs).toEqual([]);
  });
});
