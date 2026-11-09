import { z } from "zod";

export const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const SCHEMA_MAX_DEPTH = 5;
export const SCHEMA_MAX_FIELDS = 200;
export const SCHEMA_MAX_BYTES = 64 * 1024;
export const PATTERN_MAX_LENGTH = 200;
export const ENUM_MAX_VALUES = 100;
export const IMAGE_ID_PATTERN = "^upl_[A-Za-z0-9]{6,64}$";

const RESERVED_NAMES = new Set(["__proto__", "constructor", "prototype"]);

export const STRING_FORMATS = ["email", "uuid", "uri"] as const;
export const IMAGE_FORMATS = ["jpeg", "png", "webp", "svg"] as const;
export type StringFormat = (typeof STRING_FORMATS)[number];
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

type Base = { name: string; title?: string; description?: string; required?: boolean };

export type FieldDef = Base &
  (
    | {
        type: "string";
        minLength?: number;
        maxLength?: number;
        pattern?: string;
        format?: StringFormat;
        default?: string;
      }
    | { type: "number" | "integer"; minimum?: number; maximum?: number; default?: number }
    | { type: "boolean"; default?: boolean }
    | { type: "date" | "datetime" }
    | { type: "enum"; values: string[]; default?: string }
    | { type: "image"; formats?: ImageFormat[]; maxSizeMb?: number; maxMegapixels?: number }
    | { type: "array"; items: FieldDef; minItems?: number; maxItems?: number }
    | { type: "object"; fields: FieldDef[] }
  );

export type FieldType = FieldDef["type"];
export type TemplateSchema = { fields: FieldDef[] };

const text = (max: number) => z.string().max(max);
const count = z.number().int().min(0).max(1_000_000);

const base = {
  name: z.string().regex(FIELD_NAME_PATTERN, "Nom lotin harf, raqam va _ dan iborat bo'lsin"),
  title: text(200).optional(),
  description: text(1000).optional(),
  required: z.boolean().optional(),
};

export const fieldDefSchema: z.ZodType<FieldDef> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      ...base,
      type: z.literal("string"),
      minLength: count.optional(),
      maxLength: count.optional(),
      pattern: z.string().optional(),
      format: z.enum(STRING_FORMATS).optional(),
      default: z.string().optional(),
    }),
    z.strictObject({
      ...base,
      type: z.enum(["number", "integer"]),
      minimum: z.number().optional(),
      maximum: z.number().optional(),
      default: z.number().optional(),
    }),
    z.strictObject({ ...base, type: z.literal("boolean"), default: z.boolean().optional() }),
    z.strictObject({ ...base, type: z.enum(["date", "datetime"]) }),
    z.strictObject({
      ...base,
      type: z.literal("enum"),
      values: z.array(text(200)).min(1).max(ENUM_MAX_VALUES),
      default: z.string().optional(),
    }),
    z.strictObject({
      ...base,
      type: z.literal("image"),
      formats: z.array(z.enum(IMAGE_FORMATS)).min(1).optional(),
      maxSizeMb: z.number().positive().max(500).optional(),
      maxMegapixels: z.number().positive().max(100).optional(),
    }),
    z.strictObject({
      ...base,
      type: z.literal("array"),
      items: fieldDefSchema,
      minItems: count.optional(),
      maxItems: count.optional(),
    }),
    z.strictObject({ ...base, type: z.literal("object"), fields: z.array(fieldDefSchema) }),
  ]),
);

/**
 * Heuristic ReDoS guard: bounded length, compiles under the `u` flag (as Ajv does), no
 * backreferences/lookbehind, no quantified group that itself contains a quantifier.
 */
export function isSafePattern(pattern: string): boolean {
  if (pattern.length > PATTERN_MAX_LENGTH) return false;
  try {
    new RegExp(pattern, "u");
  } catch {
    return false;
  }
  if (/\\[1-9]|\\k</.test(pattern) || /\(\?<[=!]/.test(pattern)) return false;
  return !/\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/.test(pattern);
}

type Issue = { path: (string | number)[]; message: string };

function lint(fields: FieldDef[], depth: number, path: (string | number)[], issues: Issue[]) {
  if (depth > SCHEMA_MAX_DEPTH) {
    issues.push({ path, message: `Ichma-ich chuqurlik ${SCHEMA_MAX_DEPTH} dan oshmasin` });
    return;
  }
  const seen = new Set<string>();
  fields.forEach((field, i) => {
    const at = [...path, i];
    if (RESERVED_NAMES.has(field.name)) {
      issues.push({ path: [...at, "name"], message: "Bu nomni ishlatib bo'lmaydi" });
    }
    if (seen.has(field.name)) {
      issues.push({ path: [...at, "name"], message: "Bu nom takrorlangan" });
    }
    seen.add(field.name);
    lintField(field, depth, at, issues);
  });
}

function lintField(field: FieldDef, depth: number, at: (string | number)[], issues: Issue[]) {
  const add = (key: string, message: string) => issues.push({ path: [...at, key], message });
  switch (field.type) {
    case "string":
      if (field.pattern !== undefined && !isSafePattern(field.pattern)) {
        add("pattern", "Pattern xavfli yoki noto'g'ri");
      }
      if (
        field.minLength !== undefined &&
        field.maxLength !== undefined &&
        field.minLength > field.maxLength
      ) {
        add("minLength", "Minimal uzunlik maksimaldan katta");
      }
      break;
    case "number":
    case "integer":
      if (
        field.minimum !== undefined &&
        field.maximum !== undefined &&
        field.minimum > field.maximum
      ) {
        add("minimum", "Minimum maksimumdan katta");
      }
      break;
    case "enum":
      if (new Set(field.values).size !== field.values.length) {
        add("values", "Qiymatlar takrorlangan");
      }
      if (field.default !== undefined && !field.values.includes(field.default)) {
        add("default", "Standart qiymat ro'yxatda yo'q");
      }
      break;
    case "array":
      if (
        field.minItems !== undefined &&
        field.maxItems !== undefined &&
        field.minItems > field.maxItems
      ) {
        add("minItems", "Minimal soni maksimaldan katta");
      }
      lintField(field.items, depth + 1, [...at, "items"], issues);
      if (depth + 1 > SCHEMA_MAX_DEPTH) {
        issues.push({ path: [...at, "items"], message: "Chuqurlik oshib ketdi" });
      }
      break;
    case "object":
      lint(field.fields, depth + 1, [...at, "fields"], issues);
      break;
    default:
      break;
  }
}

function countFields(fields: FieldDef[]): number {
  return fields.reduce((n, f) => {
    if (f.type === "object") return n + 1 + countFields(f.fields);
    if (f.type === "array") return n + 1 + countFields([f.items]);
    return n + 1;
  }, 0);
}

export const templateSchemaSchema: z.ZodType<TemplateSchema> = z
  .strictObject({ fields: z.array(fieldDefSchema).max(SCHEMA_MAX_FIELDS) })
  .superRefine((schema, ctx) => {
    const issues: Issue[] = [];
    lint(schema.fields, 1, ["fields"], issues);
    if (countFields(schema.fields) > SCHEMA_MAX_FIELDS) {
      issues.push({
        path: ["fields"],
        message: `Maydonlar soni ${SCHEMA_MAX_FIELDS} dan oshmasin`,
      });
    }
    if (JSON.stringify(schema).length > SCHEMA_MAX_BYTES) {
      issues.push({ path: ["fields"], message: "Schema hajmi juda katta" });
    }
    for (const issue of issues) ctx.addIssue({ code: "custom", ...issue });
  });

// ---------- JSON Schema compiler ----------

export type JsonSchema = { [key: string]: unknown };

const clean = (o: Record<string, unknown>): JsonSchema =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function fieldToJson(f: FieldDef): JsonSchema {
  const meta = { title: f.title, description: f.description };
  switch (f.type) {
    case "string":
      return clean({
        type: "string",
        ...meta,
        minLength: f.minLength,
        maxLength: f.maxLength,
        pattern: f.pattern,
        format: f.format,
        default: f.default,
      });
    case "number":
    case "integer":
      return clean({
        type: f.type,
        ...meta,
        minimum: f.minimum,
        maximum: f.maximum,
        default: f.default,
      });
    case "boolean":
      return clean({ type: "boolean", ...meta, default: f.default });
    case "date":
      return clean({ type: "string", format: "date", ...meta });
    case "datetime":
      return clean({ type: "string", format: "date-time", ...meta });
    case "enum":
      return clean({ type: "string", enum: f.values, ...meta, default: f.default });
    case "image":
      return clean({
        type: "string",
        pattern: IMAGE_ID_PATTERN,
        ...meta,
        "x-image": clean({
          formats: f.formats,
          maxSizeMb: f.maxSizeMb,
          maxMegapixels: f.maxMegapixels,
        }),
      });
    case "array":
      return clean({
        type: "array",
        items: fieldToJson(f.items),
        ...meta,
        minItems: f.minItems,
        maxItems: f.maxItems,
      });
    case "object":
      return objectToJson(f.fields, meta);
  }
}

function objectToJson(fields: FieldDef[], meta: Record<string, unknown> = {}): JsonSchema {
  const required = fields.filter((f) => f.required).map((f) => f.name);
  return clean({
    type: "object",
    ...meta,
    properties: Object.fromEntries(fields.map((f) => [f.name, fieldToJson(f)])),
    required: required.length ? required : undefined,
    additionalProperties: false,
  });
}

export const toJsonSchema = (schema: TemplateSchema): JsonSchema => objectToJson(schema.fields);

// ---------- sample data ----------

function sampleValue(f: FieldDef): unknown {
  switch (f.type) {
    case "string": {
      if (f.default !== undefined) return f.default;
      let s =
        f.format === "email"
          ? "user@example.com"
          : f.format === "uuid"
            ? "123e4567-e89b-12d3-a456-426614174000"
            : f.format === "uri"
              ? "https://example.com"
              : "Matn";
      if (f.minLength !== undefined && s.length < f.minLength) s = s.padEnd(f.minLength, "x");
      if (f.maxLength !== undefined) s = s.slice(0, f.maxLength);
      return s;
    }
    case "number":
    case "integer": {
      if (f.default !== undefined) return f.default;
      let n = f.minimum ?? 0;
      if (f.maximum !== undefined && n > f.maximum) n = f.maximum;
      return n;
    }
    case "boolean":
      return f.default ?? false;
    case "date":
      return "2024-01-31";
    case "datetime":
      return "2024-01-31T09:00:00Z";
    case "enum":
      return f.default ?? f.values[0];
    case "image":
      return "upl_sample01";
    case "array": {
      const n = Math.min(Math.max(f.minItems ?? 1, 1), f.maxItems ?? 1);
      return Array.from({ length: n }, () => sampleValue(f.items));
    }
    case "object":
      return sampleObject(f.fields);
  }
}

function sampleObject(fields: FieldDef[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.name, sampleValue(f)]));
}

/** Best-effort sample; `pattern` constraints cannot be satisfied automatically. */
export const sampleFromSchema = (schema: TemplateSchema) => sampleObject(schema.fields);

// ---------- breaking-change diff ----------

export type BreakingChange = { path: string; kind: "removed" | "type_changed" | "required_added" };

type Flat = Map<string, { type: FieldType; required: boolean; parent: string }>;

function flatten(fields: FieldDef[], prefix: string, out: Flat) {
  for (const f of fields) {
    const path = `${prefix}/${f.name}`;
    out.set(path, { type: f.type, required: Boolean(f.required), parent: prefix });
    if (f.type === "object") flatten(f.fields, path, out);
    if (f.type === "array") flatten([{ ...f.items, name: "[]" }], path, out);
  }
}

export function diffSchemas(prev: TemplateSchema, next: TemplateSchema): BreakingChange[] {
  const a: Flat = new Map();
  const b: Flat = new Map();
  flatten(prev.fields, "", a);
  flatten(next.fields, "", b);
  const changes: BreakingChange[] = [];
  for (const [path, old] of a) {
    const now = b.get(path);
    if (!now) {
      if (!path.endsWith("/[]")) changes.push({ path, kind: "removed" });
    } else if (now.type !== old.type) changes.push({ path, kind: "type_changed" });
  }
  for (const [path, now] of b) {
    if (!now.required) continue;
    const old = a.get(path);
    const parentExisted = now.parent === "" || a.has(now.parent);
    if ((old && !old.required) || (!old && parentExisted)) {
      changes.push({ path, kind: "required_added" });
    }
  }
  return changes;
}
