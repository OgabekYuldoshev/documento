import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { uploadsService } from "../src/modules/uploads/uploads.service";
import { callerFor, createUser } from "./factories";
import { solidPng } from "./png";

const body = (bytes: Uint8Array) =>
  new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });

describe("upload quota", () => {
  it("never lets parallel uploads overshoot the project quota", async () => {
    const owner = callerFor(await createUser());
    const created = await owner.projects.create({ name: "Quota project" });
    const project = (await db.select().from(schema.project)).find((p) => p.id === created.id);
    if (!project) throw new Error("no project");
    const png = solidPng(8, 8);
    const before = env.UPLOAD_PROJECT_QUOTA_MB;
    env.UPLOAD_PROJECT_QUOTA_MB = (png.length * 2.5) / (1024 * 1024); // room for exactly two

    try {
      // No Content-Length: the early check cannot help, only the final one can.
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, () => uploadsService.receive(project, null, body(png))),
      );
      const ok = results.filter((r) => r.status === "fulfilled");
      expect(ok).toHaveLength(2);
      for (const r of results.filter((r) => r.status === "rejected")) {
        expect(r).toMatchObject({ reason: { type: "quota_exceeded" } });
      }
    } finally {
      env.UPLOAD_PROJECT_QUOTA_MB = before;
    }
  });
});
