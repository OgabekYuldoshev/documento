import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "../src/db/client";
import { generationsRepository } from "../src/modules/generations/generations.repository";
import { jobKey, pump, queueStats } from "../src/modules/generations/queue";
import { storage } from "../src/modules/storage/storage";
import { callerFor, createUser } from "./factories";

const render = vi.hoisted(() => ({ next: null as unknown }));
vi.mock("../src/modules/render/render.service", async (orig) => ({
  ...(await orig<typeof import("../src/modules/render/render.service")>()),
  // Wall time of the job is >= 60 ms (we wait); the render itself reports its own time.
  renderToFile: async () => {
    await new Promise((r) => setTimeout(r, 60));
    return render.next;
  },
}));

afterEach(() => vi.restoreAllMocks());

async function queuedJob() {
  while (await generationsRepository.claimNext()) {} // drain leftovers from other tests
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Duration project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Duration tpl" });
  const [version] = await db
    .select()
    .from(schema.templateVersion)
    .where(eq(schema.templateVersion.templateId, tpl.id));
  if (!version) throw new Error("no version");
  const id = crypto.randomUUID();
  await db.insert(schema.generation).values({
    id,
    projectId: project.id,
    templateId: tpl.id,
    templateVersionId: version.id,
    source: "ui",
    status: "queued",
    inputSha256: "x",
    queuedAt: new Date(),
  });
  await storage.put(jobKey(id), Buffer.from(JSON.stringify({ name: "Ali" })));
  return id;
}

const settle = async (id: string) => {
  await pump();
  await vi.waitFor(async () => {
    expect(queueStats().inFlight).toBe(0);
    const row = await generationsRepository.find(id);
    expect(["queued", "processing"]).not.toContain(row?.status);
  });
  return generationsRepository.find(id);
};

describe("generation duration", () => {
  it("records the render time, not the time spent waiting for the scheduler", async () => {
    const id = await queuedJob();
    const dir = await mkdtemp(join(tmpdir(), "dur-"));
    const pdfPath = join(dir, "out.pdf");
    await writeFile(pdfPath, "%PDF");
    render.next = {
      ok: true,
      pdfPath,
      svgPaths: [],
      bytes: 4,
      pages: 1,
      durationMs: 7,
      dispose: async () => {},
    };
    const row = await settle(id);
    expect(row?.status).toBe("ok");
    expect(row?.durationMs).toBe(7);
  });

  it("does the same for failed renders", async () => {
    const id = await queuedJob();
    render.next = {
      ok: false,
      kind: "compile",
      durationMs: 9,
      diagnostics: [{ severity: "error", message: "boom" }],
    };
    const row = await settle(id);
    expect(row?.status).toBe("render_error");
    expect(row?.durationMs).toBe(9);
  });
});
