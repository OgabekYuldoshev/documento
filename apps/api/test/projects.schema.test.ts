import { createProjectSchema, updateProjectSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { createUser } from "./factories";

const base = (ownerId: string, slug: string) => ({
  id: crypto.randomUUID(),
  name: "P",
  slug,
  ownerId,
});

const failure = (p: Promise<unknown>) =>
  p.then(
    () => "",
    (e: unknown) => String((e as Error).cause ?? e),
  );

describe("project table", () => {
  it("rejects duplicate slugs", async () => {
    const u = await createUser();
    await db.insert(schema.project).values(base(u.id, "dup"));
    expect(await failure(db.insert(schema.project).values(base(u.id, "dup")))).toMatch(/UNIQUE/);
  });

  it("rejects unknown owner", async () => {
    expect(await failure(db.insert(schema.project).values(base("nope", "x1")))).toMatch(
      /FOREIGN KEY/,
    );
  });

  it("restricts deleting an owner", async () => {
    const u = await createUser();
    await db.insert(schema.project).values(base(u.id, "owned"));
    expect(await failure(db.delete(schema.user).where(eq(schema.user.id, u.id)))).toMatch(
      /FOREIGN KEY/,
    );
  });
});

describe("shared project schemas", () => {
  it("trims name and enforces min length", () => {
    expect(createProjectSchema.safeParse({ name: " a " }).success).toBe(false);
    expect(createProjectSchema.safeParse({ name: " ab " }).data?.name).toBe("ab");
  });

  it.each([0, -1, 1.5])("rejects retentionDays %s", (retentionDays) => {
    const r = updateProjectSchema.safeParse({
      projectId: "p",
      name: "ab",
      description: null,
      retentionDays,
    });
    expect(r.success).toBe(false);
  });

  it.each([null, 7])("accepts retentionDays %s", (retentionDays) => {
    const r = updateProjectSchema.safeParse({
      projectId: "p",
      name: "ab",
      description: null,
      retentionDays,
    });
    expect(r.success).toBe(true);
  });
});
