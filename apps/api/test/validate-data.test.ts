import type { TemplateSchema } from "@documento/shared";
import { describe, expect, it } from "vitest";
import { validateData } from "../src/modules/templates/validate-data";

const schema: TemplateSchema = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 2 },
    price: { type: "number", minimum: 0 },
    kind: { enum: ["a", "b"] },
    born: { type: "string", format: "date" },
    photo: { type: "string", format: "image" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { price: { type: "number" } },
        required: ["price"],
        additionalProperties: false,
      },
    },
  },
  required: ["name"],
  additionalProperties: false,
};

const errs = (data: unknown, opts?: { maxPayloadBytes?: number }) => {
  const r = validateData(schema, data, opts);
  return r.ok ? [] : r.errors;
};

describe("validateData", () => {
  it("accepts valid data", () => {
    const r = validateData(schema, {
      name: "Ali",
      price: 3,
      kind: "a",
      born: "2024-02-29",
      photo: "upl_abc123",
      items: [{ price: 1 }],
    });
    expect(r.ok).toBe(true);
  });

  it("reports unknown key, wrong type, missing required with pointers", () => {
    const e = errs({ price: "5", extra: 1, items: [{ price: 1 }, {}] });
    const by = Object.fromEntries(e.map((x) => [x.path, x.code]));
    expect(by["/name"]).toBe("required");
    expect(by["/price"]).toBe("type");
    expect(by["/extra"]).toBe("unknown_field");
    expect(by["/items/1/price"]).toBe("required");
    expect(e.every((x) => x.message.length > 0)).toBe(true);
  });

  it("flags enum, format, pattern and bad image id", () => {
    const e = errs({ name: "Ali", kind: "z", born: "31/01/2024", photo: "../etc/passwd" });
    expect(e.map((x) => `${x.path}:${x.code}`).sort()).toEqual([
      "/born:format",
      "/kind:enum",
      "/photo:format",
    ]);
  });

  it.each([null, [], "x", 5])("never throws on root %j", (root) => {
    const e = errs(root);
    expect(e[0]?.code).toBe("type");
  });

  it("enforces payload limit", () => {
    const e = errs({ name: "Ali", note: "x".repeat(100) }, { maxPayloadBytes: 50 });
    expect(e).toEqual([expect.objectContaining({ code: "payload_too_large" })]);
  });

  it("does not mutate the caller's data", () => {
    const data = { name: "Ali" };
    validateData(schema, data);
    expect(data).toEqual({ name: "Ali" });
  });
});
