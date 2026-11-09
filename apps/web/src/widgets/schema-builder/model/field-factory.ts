import type { FieldDef, FieldType } from "@documento/shared";

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: "string", label: "Matn" },
  { value: "number", label: "Son" },
  { value: "integer", label: "Butun son" },
  { value: "boolean", label: "Ha/Yo'q" },
  { value: "date", label: "Sana" },
  { value: "datetime", label: "Sana va vaqt" },
  { value: "enum", label: "Ro'yxatdan tanlash" },
  { value: "image", label: "Rasm" },
  { value: "array", label: "Massiv" },
  { value: "object", label: "Obyekt" },
];

export function createField(type: FieldType, name: string): FieldDef {
  switch (type) {
    case "enum":
      return { name, type, values: ["variant1"] };
    case "array":
      return { name, type, items: { name: "item", type: "string" } };
    case "object":
      return { name, type, fields: [] };
    default:
      return { name, type } as FieldDef;
  }
}

/** Switching type keeps identity (name, title, required) and drops type-specific constraints. */
export function changeFieldType(field: FieldDef, type: FieldType): FieldDef {
  const next = createField(type, field.name);
  next.title = field.title;
  next.description = field.description;
  next.required = field.required;
  return next;
}

export function nextFieldName(existing: FieldDef[]): string {
  const names = new Set(existing.map((f) => f.name));
  for (let i = existing.length + 1; ; i++) {
    if (!names.has(`field${i}`)) return `field${i}`;
  }
}
