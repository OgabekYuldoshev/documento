import { eq } from "drizzle-orm";
import { db, schema } from "./client";

type Json = Record<string, unknown>;
type Field = Json & { name: string; type: string; required?: boolean };

const clean = (o: Json): Json =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

function field(f: Field): Json {
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
        format: "image",
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
        items: field(f.items as Field),
        ...meta,
        minItems: f.minItems,
        maxItems: f.maxItems,
      });
    default:
      return object(f.fields as Field[], meta);
  }
}

function object(fields: Field[], meta: Json = {}): Json {
  const required = fields.filter((f) => f.required).map((f) => f.name);
  return clean({
    type: "object",
    ...meta,
    properties: Object.fromEntries(fields.map((f) => [f.name, field(f)])),
    required: required.length ? required : undefined,
    additionalProperties: false,
  });
}

/** Old builder DSL (`{ fields: [...] }`) -> JSON Schema. */
export const convertLegacySchema = (legacy: { fields: Field[] }): Json => object(legacy.fields);

const isLegacy = (s: unknown): s is { fields: Field[] } =>
  typeof s === "object" && s !== null && Array.isArray((s as { fields?: unknown }).fields);

/** Idempotent: rewrites template versions still stored in the old DSL. Returns the count. */
export async function convertLegacySchemas(): Promise<number> {
  const rows = await db.select().from(schema.templateVersion);
  let n = 0;
  for (const row of rows) {
    if (!isLegacy(row.schema)) continue;
    await db
      .update(schema.templateVersion)
      .set({ schema: convertLegacySchema(row.schema) })
      .where(eq(schema.templateVersion.id, row.id));
    n++;
  }
  return n;
}
