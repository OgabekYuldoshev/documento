import { describe, expect, it } from "vitest";
import { db, schema } from "../src/db/client";
import { projectsService } from "../src/modules/projects/projects.service";
import { usersService } from "../src/modules/users/users.service";
import { createUser } from "./factories";

describe("usersService.remove", () => {
  it("refuses to delete a user who owns projects (even archived)", async () => {
    const superadmin = await createUser({ role: "superadmin" });
    const owner = await createUser();
    const p = await projectsService.create(owner, { name: "Owned project" });
    await projectsService.archive(owner, p.id);

    const error = await usersService.remove(superadmin, new Headers(), owner.id).then(
      () => null,
      (e: { code: string; message: string }) => e,
    );
    expect(error?.code).toBe("CONFLICT");
    expect(error?.message).toContain("project'lari bor");
    const rows = await db.select().from(schema.user);
    expect(rows.some((u) => u.id === owner.id)).toBe(true);
  });
});
