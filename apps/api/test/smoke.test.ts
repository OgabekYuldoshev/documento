import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { createUser } from "./factories";

describe("test infrastructure", () => {
  it("creates users in the in-memory database", async () => {
    const { id } = await createUser({ role: "admin" });
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id));
    expect(row?.role).toBe("admin");
  });

  it("keeps the superadmin protection trigger", async () => {
    const { id } = await createUser({ role: "superadmin" });
    const error = await db
      .delete(schema.user)
      .where(eq(schema.user.id, id))
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(String((error as Error).cause)).toMatch(/superadmin cannot be deleted/);
  });
});
