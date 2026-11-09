import { templateSchemaSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { convertLegacySchema, convertLegacySchemas } from "../src/db/legacy-schema";
import { assertSchemaCompiles, validateData } from "../src/modules/templates/validate-data";
import { callerFor, createUser } from "./factories";

describe("legacy schema conversion", () => {
  it("turns the old DSL into a valid JSON Schema", () => {
    const out = convertLegacySchema({
      fields: [
        { name: "name", type: "string", required: true, format: "email" },
        { name: "born", type: "date" },
        { name: "photo", type: "image", formats: ["png"] },
        { name: "tags", type: "array", items: { name: "item", type: "enum", values: ["a", "b"] } },
      ],
    });
    expect(templateSchemaSchema.safeParse(out).success).toBe(true);
    expect(() => assertSchemaCompiles(out)).not.toThrow();
    expect(validateData(out, { name: "a@b.co", tags: ["a"] }).ok).toBe(true);
    expect(validateData(out, { name: "nope" }).ok).toBe(false);
  });

  it("rewrites stored legacy rows once", async () => {
    const owner = callerFor(await createUser());
    const project = await owner.projects.create({ name: "Legacy" });
    const tpl = await owner.templates.create({ projectId: project.id, name: "Old" });
    const [row] = await db
      .select()
      .from(schema.templateVersion)
      .where(eq(schema.templateVersion.templateId, tpl.id));
    if (!row) throw new Error("no version");
    await db
      .update(schema.templateVersion)
      .set({ schema: { fields: [] } as never })
      .where(eq(schema.templateVersion.id, row.id));
    expect(await convertLegacySchemas()).toBeGreaterThanOrEqual(1);
    const [after] = await db
      .select()
      .from(schema.templateVersion)
      .where(eq(schema.templateVersion.id, row.id));
    expect(after?.schema).toMatchObject({ type: "object", properties: {} });
    expect(await convertLegacySchemas()).toBe(0);
  });
});
