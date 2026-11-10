import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, schema } from "../src/db/client";
import { generationsRepository } from "../src/modules/generations/generations.repository";
import { jobKey, pump, queueStats } from "../src/modules/generations/queue";
import { storage } from "../src/modules/storage/storage";
import { callerFor, createUser } from "./factories";

async function seedJob(over: Partial<typeof schema.generation.$inferInsert> = {}, withFile = true) {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Queue project" });
  const tpl = await owner.templates.create({ projectId: project.id, name: "Queue tpl" });
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
    status: "processing",
    inputSha256: "x",
    queuedAt: new Date(),
    startedAt: new Date(),
    ...over,
  });
  if (withFile) await storage.put(jobKey(id), Buffer.from("{}"));
  return id;
}

const status = async (id: string) => (await generationsRepository.find(id))?.status;
const hasFile = (id: string) =>
  import("node:fs").then(({ existsSync }) => existsSync(storage.getPath(jobKey(id))));

afterEach(() => vi.restoreAllMocks());

describe("queue recovery", () => {
  it("counts an attempt every time a job is claimed", async () => {
    const id = await seedJob({ status: "queued", startedAt: null, queuedAt: new Date(0) });
    const claimed = await generationsRepository.claimNext();
    expect(claimed?.id).toBe(id);
    expect(claimed?.attempts).toBe(1);
  });

  it("requeues interrupted jobs but gives up on a job that already used all attempts", async () => {
    const retry = await seedJob({ attempts: 1 });
    const poison = await seedJob({ attempts: 3 });

    const result = await generationsRepository.recoverStalled({ maxAttempts: 3 });

    expect(result.requeued).toContain(retry);
    expect(result.abandoned).toContain(poison);
    expect(await status(retry)).toBe("queued");
    expect((await generationsRepository.find(retry))?.startedAt).toBeNull();
    const dead = await generationsRepository.find(poison);
    expect(dead?.status).toBe("render_error");
    expect(dead?.finishedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(dead?.errorJson)).toContain("internal");
  });

  it("leaves jobs that are fresh or still running in this process alone", async () => {
    const fresh = await seedJob({ startedAt: new Date() });
    const running = await seedJob({ startedAt: new Date(Date.now() - 3_600_000) });
    const orphan = await seedJob({ startedAt: new Date(Date.now() - 3_600_000) });

    const result = await generationsRepository.recoverStalled({
      maxAttempts: 3,
      startedBefore: new Date(Date.now() - 60_000),
      skip: [running],
    });

    expect(result.requeued).toEqual([orphan]);
    expect(await status(fresh)).toBe("processing");
    expect(await status(running)).toBe("processing");
  });

  it("survives a failing database write while recording a job failure", async () => {
    // No job file: processJob throws, then even the failure record cannot be written.
    const id = await seedJob({ status: "queued", startedAt: null, queuedAt: new Date(0) }, false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const update = vi
      .spyOn(generationsRepository, "update")
      .mockRejectedValue(new Error("db down"));

    await pump();
    await vi.waitFor(() => expect(queueStats().inFlight).toBe(0));

    expect(update).toHaveBeenCalled();
    // The row stays `processing`: the watchdog (not a crash) picks it up later.
    expect(await status(id)).toBe("processing");
    expect(await hasFile(id)).toBe(false);
  });
});
