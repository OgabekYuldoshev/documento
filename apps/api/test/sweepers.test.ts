import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "../src/db/client";
import { generationsService } from "../src/modules/generations/generations.service";
import { storage } from "../src/modules/storage/storage";
import { uploadsService } from "../src/modules/uploads/uploads.service";
import { callerFor, createUser } from "./factories";

afterEach(() => vi.restoreAllMocks());

async function projectWithVersion() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Sweep project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Sweep tpl" });
  const [version] = await db
    .select()
    .from(schema.templateVersion)
    .where(eq(schema.templateVersion.templateId, tpl.id));
  if (!version) throw new Error("no version");
  return { projectId: project.id, templateId: tpl.id, versionId: version.id };
}

describe("retention sweeper resilience", () => {
  it("keeps cleaning after one PDF cannot be removed, and retries that one later", async () => {
    const p = await projectWithVersion();
    const rows = ["bad", "good"].map((name) => ({
      id: crypto.randomUUID(),
      key: `pdf/${name}-${crypto.randomUUID()}.pdf`,
    }));
    for (const { id, key } of rows) {
      await storage.put(key, Buffer.from("%PDF"));
      await db.insert(schema.generation).values({
        id,
        projectId: p.projectId,
        templateId: p.templateId,
        templateVersionId: p.versionId,
        source: "ui",
        status: "ok",
        inputSha256: "x",
        queuedAt: new Date(0),
        pdfKey: key,
        pdfExpiresAt: new Date(1000),
      });
    }
    const [bad, good] = rows as [(typeof rows)[number], (typeof rows)[number]];
    vi.spyOn(console, "error").mockImplementation(() => {});
    const realRemove = storage.remove.bind(storage);
    vi.spyOn(storage, "remove").mockImplementation((key) =>
      key === bad.key ? Promise.reject(new Error("disk")) : realRemove(key),
    );

    const cleaned = await generationsService.cleanExpired();

    expect(cleaned).toBe(1);
    const status = async (id: string) =>
      (await db.select().from(schema.generation).where(eq(schema.generation.id, id)))[0]?.status;
    expect(await status(good.id)).toBe("expired");
    expect(await status(bad.id)).toBe("ok"); // untouched, so the next sweep retries it
  });
});

describe("upload sweeper resilience", () => {
  it("keeps cleaning after one upload file cannot be removed", async () => {
    const p = await projectWithVersion();
    const make = async (name: string) => {
      const id = `upl_${name}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
      await db.insert(schema.upload).values({
        id,
        projectId: p.projectId,
        format: "png",
        mime: "image/png",
        size: 10,
        sha256: "x",
        storageKey: `uploads/${id}`,
        expiresAt: new Date(1000),
      });
      return { id, key: `uploads/${id}` };
    };
    const bad = await make("bad");
    const good = await make("good");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const realRemove = storage.remove.bind(storage);
    vi.spyOn(storage, "remove").mockImplementation((key) =>
      key === bad.key ? Promise.reject(new Error("disk")) : realRemove(key),
    );

    await uploadsService.cleanExpired();

    const ids = (await db.select().from(schema.upload)).map((r) => r.id);
    expect(ids).toContain(bad.id);
    expect(ids).not.toContain(good.id);
  });
});
