import { z } from "zod";

/**
 * Templates describe their input with a plain JSON Schema (draft-07, validated by Ajv +
 * ajv-formats on the API). This module holds what both apps need without Ajv: structural limits,
 * sample generation, breaking-change diff and image-field helpers.
 *
 * Conventions on top of JSON Schema:
 * - root is `{ "type": "object", "properties": {...} }`
 * - an image field is `{ "type": "string", "format": "image", "x-image": { formats, maxSizeMb,
 *   maxMegapixels } }` and carries an upload id (`upl_...`)
 * - `$ref` is not allowed (keeps schemas small and non-recursive)
 */

export const FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
export const SCHEMA_MAX_DEPTH = 5;
export const SCHEMA_MAX_FIELDS = 200;
export const SCHEMA_MAX_BYTES = 64 * 1024;
export const PATTERN_MAX_LENGTH = 200;
export const IMAGE_ID_PATTERN = "^upl_[A-Za-z0-9]{6,64}$";
export const IMAGE_FORMAT_NAME = "image";
export const IMAGE_FORMATS = ["jpeg", "png", "webp", "svg"] as const;
export type ImageFormat = (typeof IMAGE_FORMATS)[number];

const RESERVED_NAMES = new Set(["__proto__", "constructor", "prototype"]);
const FORBIDDEN_KEYWORDS = new Set(["$ref", "$dynamicRef", "$recursiveRef"]);
const DRAFT_07 = /^http:\/\/json-schema\.org\/draft-07\/schema#?$/;

export type JsonSchema = { [key: string]: unknown };
export type TemplateSchema = JsonSchema;

const isRecord = (v: unknown): v is JsonSchema =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Starter schema for new templates. */
export const DEFAULT_TEMPLATE_JSON_SCHEMA: JsonSchema = {
  type: "object",
  properties: { title: { type: "string", title: "Sarlavha" } },
  required: ["title"],
  additionalProperties: false,
};

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

/** Walks every JSON value once: forbidden keywords, unsafe patterns, field names, counts. */
function lintNode(
  node: unknown,
  path: (string | number)[],
  issues: Issue[],
  stats: { fields: number },
  inProperties = false,
) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      lintNode(v, [...path, i], issues, stats);
    });
    return;
  }
  if (!isRecord(node)) return;
  for (const [key, value] of Object.entries(node)) {
    const at = [...path, key];
    if (inProperties) {
      stats.fields++;
      if (!FIELD_NAME_PATTERN.test(key)) {
        issues.push({ path: at, message: "Nom lotin harf, raqam va _ dan iborat bo'lsin" });
      } else if (RESERVED_NAMES.has(key)) {
        issues.push({ path: at, message: "Bu nomni ishlatib bo'lmaydi" });
      }
      lintNode(value, at, issues, stats);
      continue;
    }
    if (FORBIDDEN_KEYWORDS.has(key)) {
      issues.push({ path: at, message: "`$ref` qo'llab-quvvatlanmaydi, schemani to'liq yozing" });
    } else if (key === "pattern" && typeof value === "string" && !isSafePattern(value)) {
      issues.push({ path: at, message: "Pattern xavfli yoki noto'g'ri" });
    } else if (key === "patternProperties" && isRecord(value)) {
      for (const p of Object.keys(value)) {
        if (!isSafePattern(p)) issues.push({ path: [...at, p], message: "Pattern xavfli" });
      }
    }
    lintNode(value, at, issues, stats, key === "properties");
  }
}

/** Object/array nesting through `properties` and `items` only. */
function schemaDepth(node: unknown): number {
  if (Array.isArray(node)) return Math.max(0, ...node.map(schemaDepth));
  if (!isRecord(node)) return 0;
  let deepest = 0;
  if (isRecord(node.properties)) {
    for (const child of Object.values(node.properties)) {
      deepest = Math.max(deepest, schemaDepth(child));
    }
  }
  if (node.items !== undefined) deepest = Math.max(deepest, schemaDepth(node.items));
  return deepest + (node.type === "object" || node.type === "array" ? 1 : 0);
}

export function lintSchema(schema: JsonSchema): Issue[] {
  const issues: Issue[] = [];
  if (schema.type !== "object") {
    issues.push({ path: ["type"], message: 'Ildiz `"type": "object"` bo\'lishi kerak' });
  }
  if (typeof schema.$schema === "string" && !DRAFT_07.test(schema.$schema)) {
    issues.push({ path: ["$schema"], message: "Faqat JSON Schema draft-07 qo'llab-quvvatlanadi" });
  }
  if (JSON.stringify(schema).length > SCHEMA_MAX_BYTES) {
    issues.push({ path: [], message: "Schema hajmi juda katta" });
  }
  const stats = { fields: 0 };
  lintNode(schema, [], issues, stats, false);
  if (stats.fields > SCHEMA_MAX_FIELDS) {
    issues.push({
      path: ["properties"],
      message: `Maydonlar soni ${SCHEMA_MAX_FIELDS} dan oshmasin`,
    });
  }
  if (schemaDepth(schema) > SCHEMA_MAX_DEPTH) {
    issues.push({ path: [], message: `Ichma-ich chuqurlik ${SCHEMA_MAX_DEPTH} dan oshmasin` });
  }
  return issues;
}

export const templateSchemaSchema: z.ZodType<TemplateSchema> = z
  .record(z.string(), z.unknown())
  .superRefine((schema, ctx) => {
    for (const issue of lintSchema(schema)) ctx.addIssue({ code: "custom", ...issue });
  });

// ---------- sample data ----------

const FORMAT_SAMPLES: Record<string, string> = {
  email: "user@example.com",
  "idn-email": "user@example.com",
  uuid: "123e4567-e89b-12d3-a456-426614174000",
  uri: "https://example.com",
  "uri-reference": "/path",
  "uri-template": "/items/{id}",
  url: "https://example.com",
  hostname: "example.com",
  ipv4: "192.0.2.1",
  ipv6: "2001:db8::1",
  date: "2024-01-31",
  time: "09:00:00Z",
  "date-time": "2024-01-31T09:00:00Z",
  duration: "P1D",
  regex: ".*",
  "json-pointer": "/a",
  "relative-json-pointer": "0",
  [IMAGE_FORMAT_NAME]: "upl_sample01",
};

const typeOf = (s: JsonSchema): string | undefined =>
  Array.isArray(s.type)
    ? (s.type.find((t) => t !== "null") as string | undefined)
    : (s.type as string | undefined);

function sampleValue(s: unknown, depth = 0): unknown {
  if (!isRecord(s) || depth > SCHEMA_MAX_DEPTH + 1) return null;
  if (s.default !== undefined) return s.default;
  if (s.const !== undefined) return s.const;
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  switch (typeOf(s) ?? (s.properties ? "object" : undefined)) {
    case "string": {
      let text = (typeof s.format === "string" && FORMAT_SAMPLES[s.format]) || "Matn";
      if (typeof s.minLength === "number" && text.length < s.minLength) {
        text = text.padEnd(s.minLength, "x");
      }
      if (typeof s.maxLength === "number") text = text.slice(0, s.maxLength);
      return text;
    }
    case "number":
    case "integer": {
      let n =
        typeof s.minimum === "number"
          ? s.minimum
          : typeof s.exclusiveMinimum === "number"
            ? s.exclusiveMinimum + 1
            : 0;
      if (typeof s.maximum === "number" && n > s.maximum) n = s.maximum;
      return n;
    }
    case "boolean":
      return false;
    case "array": {
      const min = typeof s.minItems === "number" ? s.minItems : 0;
      const max = typeof s.maxItems === "number" ? s.maxItems : 1;
      const n = Math.min(Math.max(min, 1), max);
      return Array.from({ length: n }, () => sampleValue(s.items, depth + 1));
    }
    case "object": {
      const props = isRecord(s.properties) ? s.properties : {};
      return Object.fromEntries(
        Object.entries(props).map(([k, v]) => [k, sampleValue(v, depth + 1)]),
      );
    }
    default:
      return null;
  }
}

/** Best-effort sample; `pattern` constraints cannot be satisfied automatically. */
export const sampleFromSchema = (schema: TemplateSchema): Record<string, unknown> =>
  (sampleValue(schema) as Record<string, unknown> | null) ?? {};

// ---------- breaking-change diff ----------

export type BreakingChange = { path: string; kind: "removed" | "type_changed" | "required_added" };

type Flat = Map<string, { type: string; required: boolean; parent: string }>;

const typeKey = (s: JsonSchema) => {
  const t = Array.isArray(s.type) ? [...s.type].sort().join("|") : String(s.type ?? "any");
  return typeof s.format === "string" ? `${t}:${s.format}` : t;
};

function flatten(schema: JsonSchema, prefix: string, out: Flat) {
  const required = new Set(Array.isArray(schema.required) ? (schema.required as string[]) : []);
  const props = isRecord(schema.properties) ? schema.properties : {};
  for (const [name, def] of Object.entries(props)) {
    if (!isRecord(def)) continue;
    const path = `${prefix}/${name}`;
    out.set(path, { type: typeKey(def), required: required.has(name), parent: prefix });
    visitChildren(def, path, out);
  }
}

function visitChildren(def: JsonSchema, path: string, out: Flat) {
  if (isRecord(def.properties)) flatten(def, path, out);
  if (isRecord(def.items)) {
    const item = `${path}/[]`;
    out.set(item, { type: typeKey(def.items), required: false, parent: path });
    visitChildren(def.items, item, out);
  }
}

export function diffSchemas(prev: TemplateSchema, next: TemplateSchema): BreakingChange[] {
  const a: Flat = new Map();
  const b: Flat = new Map();
  flatten(prev, "", a);
  flatten(next, "", b);
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

// ---------- image references ----------

export type ImageField = { formats?: ImageFormat[]; maxSizeMb?: number; maxMegapixels?: number };
export type ImageRef = { path: string; id: string; field: ImageField };

const imageField = (s: JsonSchema): ImageField =>
  isRecord(s["x-image"]) ? (s["x-image"] as ImageField) : {};

function visitValue(
  schema: unknown,
  holder: Record<string, unknown> | unknown[],
  key: string | number,
  path: string,
  fn: (ref: ImageRef) => string,
  refs: ImageRef[],
) {
  if (!isRecord(schema)) return;
  const slot = holder as Record<string | number, unknown>;
  const value = slot[key];
  if (schema.format === IMAGE_FORMAT_NAME && typeof value === "string") {
    const ref = { path, id: value, field: imageField(schema) };
    refs.push(ref);
    slot[key] = fn(ref);
  } else if (Array.isArray(value) && isRecord(schema.items)) {
    for (let i = 0; i < value.length; i++) {
      visitValue(schema.items, value, i, `${path}/${i}`, fn, refs);
    }
  } else if (isRecord(value) && isRecord(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) {
      visitValue(child, value, name, `${path}/${name}`, fn, refs);
    }
  }
}

/**
 * Finds every image value (upload id string) in already schema-valid data and replaces it with
 * `fn(ref)`. Returns a transformed copy plus the references; the input is not mutated.
 */
export function transformImages(
  schema: TemplateSchema,
  data: unknown,
  fn: (ref: ImageRef) => string,
): { data: Record<string, unknown>; refs: ImageRef[] } {
  const copy = (isRecord(data) ? JSON.parse(JSON.stringify(data)) : {}) as Record<string, unknown>;
  const refs: ImageRef[] = [];
  if (isRecord(schema.properties)) {
    for (const [name, child] of Object.entries(schema.properties)) {
      visitValue(child, copy, name, `/${name}`, fn, refs);
    }
  }
  return { data: copy, refs };
}

export const collectImages = (schema: TemplateSchema, data: unknown): ImageRef[] =>
  transformImages(schema, data, (ref) => ref.id).refs;
