/** The slice of JSON Schema (draft-07) the template editor allows; enough to build a form. */
export type SchemaNode = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  format?: string;
  default?: unknown;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  "x-image"?: { formats?: string[]; maxSizeMb?: number };
};

export const nodeType = (node: SchemaNode): string | undefined =>
  Array.isArray(node.type) ? node.type.find((t) => t !== "null") : node.type;

export const isImage = (node: SchemaNode) => node.type === "string" && node.format === "image";

/** A sensible empty value for a field that has just been added (array items). */
export function emptyValue(node: SchemaNode): unknown {
  if (node.default !== undefined) return node.default;
  switch (nodeType(node)) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node.properties ?? {}))
        out[key] = emptyValue(child);
      return out;
    }
    case "array":
      return [];
    case "boolean":
      return false;
    case "number":
    case "integer":
      return undefined;
    default:
      return "";
  }
}

/**
 * Drops what the user left empty so optional fields do not fail validation
 * (`""` for a date or an image id): only required fields keep empty values.
 */
export function pruneEmpty(node: SchemaNode, value: unknown, required = true): unknown {
  if (value === undefined || value === null) return undefined;
  if (value === "" && !required) return undefined;
  if (Array.isArray(value)) {
    const item = node.items;
    return value.map((v) => (item ? pruneEmpty(item, v, true) : v)).filter((v) => v !== undefined);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      const child = node.properties?.[key];
      const kept = child ? pruneEmpty(child, v, node.required?.includes(key) ?? false) : v;
      if (kept !== undefined) out[key] = kept;
    }
    return out;
  }
  return value;
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
};

/** `accept` for the file picker, from the field's allowed formats. */
export function imageAccept(node: SchemaNode): string {
  const formats = node["x-image"]?.formats;
  const mimes = (formats?.length ? formats : Object.keys(IMAGE_MIME)).map((f) => IMAGE_MIME[f]);
  return [...new Set(mimes.filter(Boolean))].join(",");
}
