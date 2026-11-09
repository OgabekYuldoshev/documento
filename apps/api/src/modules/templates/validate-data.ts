import { createHash } from "node:crypto";
import { IMAGE_FORMAT_NAME, IMAGE_ID_PATTERN, type TemplateSchema } from "@documento/shared";
import { Ajv, type ErrorObject, type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";

export type DataError = { path: string; code: string; message: string };
export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: DataError[] };

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  coerceTypes: false,
  useDefaults: true,
  allowUnionTypes: true,
});
// Every standard format (date, time, date-time, duration, email, hostname, ipv4, ipv6, uri,
// uri-reference, uuid, regex, json-pointer, ...) from ajv-formats, plus our upload-id format.
addFormats.default(ajv, { mode: "full" });
ajv.addFormat(IMAGE_FORMAT_NAME, new RegExp(IMAGE_ID_PATTERN));
ajv.addKeyword({ keyword: "x-image", schemaType: "object" });

const cache = new Map<string, ValidateFunction>();
const CACHE_LIMIT = 200;

/** Thrown when the author's JSON Schema is not a valid Ajv (strict, draft-07) schema. */
export class SchemaDefinitionError extends Error {}

/** Compiles the schema once; throws `SchemaDefinitionError` with a readable message. */
export function assertSchemaCompiles(schema: TemplateSchema): void {
  try {
    compile(schema);
  } catch (error) {
    throw new SchemaDefinitionError(error instanceof Error ? error.message : String(error));
  }
}

function compile(json: TemplateSchema): ValidateFunction {
  const key = createHash("sha256").update(JSON.stringify(json)).digest("hex");
  const hit = cache.get(key);
  if (hit) return hit;
  const fn = ajv.compile(json);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, fn);
  return fn;
}

const FORMAT_LABELS: Record<string, string> = {
  email: "email manzili",
  "idn-email": "email manzili",
  uuid: "UUID",
  uri: "URL manzili",
  "uri-reference": "URL yoki yo'l",
  "uri-template": "URI shablon",
  hostname: "hostname",
  ipv4: "IPv4 manzil",
  ipv6: "IPv6 manzil",
  date: "sana (YYYY-MM-DD)",
  time: "vaqt (HH:MM:SS)",
  "date-time": "sana va vaqt (ISO 8601)",
  duration: "davomiylik (ISO 8601, masalan P1D)",
  regex: "regulyar ifoda",
  "json-pointer": "JSON pointer",
  "relative-json-pointer": "nisbiy JSON pointer",
  [IMAGE_FORMAT_NAME]: "rasm ID (upl_...)",
};
const TYPE_LABELS: Record<string, string> = {
  string: "matn",
  number: "son",
  integer: "butun son",
  boolean: "true/false",
  object: "obyekt",
  array: "massiv",
};

function toError(e: ErrorObject): DataError {
  const p = e.params as Record<string, unknown>;
  const base = e.instancePath;
  switch (e.keyword) {
    case "required":
      return {
        path: `${base}/${p.missingProperty}`,
        code: "required",
        message: "Majburiy maydon yuborilmagan",
      };
    case "additionalProperties":
      return {
        path: `${base}/${p.additionalProperty}`,
        code: "unknown_field",
        message: "Schemada bunday maydon yo'q",
      };
    case "type":
      return {
        path: base,
        code: "type",
        message: `${TYPE_LABELS[String(p.type)] ?? String(p.type)} bo'lishi kerak`,
      };
    case "format":
      return {
        path: base,
        code: "format",
        message: `${FORMAT_LABELS[String(p.format)] ?? String(p.format)} bo'lishi kerak`,
      };
    case "enum":
      return {
        path: base,
        code: "enum",
        message: `Ruxsat etilgan qiymatlar: ${(p.allowedValues as string[]).join(", ")}`,
      };
    case "pattern":
      return {
        path: base,
        code: "pattern",
        message: "Qiymat shablonga mos emas",
      };
    case "minLength":
      return { path: base, code: "minLength", message: `Kamida ${p.limit} ta belgi` };
    case "maxLength":
      return { path: base, code: "maxLength", message: `Ko'pi bilan ${p.limit} ta belgi` };
    case "minimum":
      return { path: base, code: "minimum", message: `Kamida ${p.limit}` };
    case "maximum":
      return { path: base, code: "maximum", message: `Ko'pi bilan ${p.limit}` };
    case "minItems":
      return { path: base, code: "minItems", message: `Kamida ${p.limit} ta element` };
    case "maxItems":
      return { path: base, code: "maxItems", message: `Ko'pi bilan ${p.limit} ta element` };
    default:
      return { path: base, code: e.keyword, message: "Qiymat noto'g'ri" };
  }
}

export function validateData(
  schema: TemplateSchema,
  data: unknown,
  opts: { maxPayloadBytes?: number } = {},
): ValidationResult {
  if (opts.maxPayloadBytes !== undefined) {
    const size = Buffer.byteLength(JSON.stringify(data) ?? "");
    if (size > opts.maxPayloadBytes) {
      return {
        ok: false,
        errors: [{ path: "", code: "payload_too_large", message: "Ma'lumot hajmi limitdan oshdi" }],
      };
    }
  }
  let validate: ValidateFunction;
  try {
    validate = compile(schema);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [{ path: "", code: "schema", message: `Schema noto'g'ri: ${message}` }],
    };
  }
  // useDefaults mutates its input: validate a copy.
  const copy = structuredClone(data);
  if (validate(copy)) return { ok: true, data: copy as Record<string, unknown> };
  return { ok: false, errors: (validate.errors ?? []).map(toError) };
}
