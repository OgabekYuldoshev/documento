import type { TemplateSchema } from "@documento/shared";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env";
import { db, schema } from "../src/db/client";
import { templatesRepository } from "../src/modules/templates/templates.repository";
import { callerFor, createUser } from "./factories";

// The dry-run is where a concurrent edit can slip in: let the test hook into it.
const hook = vi.hoisted(() => ({ during: null as null | (() => Promise<void>) }));
vi.mock("../src/modules/render/render.service", async (orig) => ({
  ...(await orig<typeof import("../src/modules/render/render.service")>()),
  runPublishDryRun: async () => {
    await hook.during?.();
  },
}));

const schemaA: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};

async function setup() {
  const owner = callerFor(await createUser());
  const project = await owner.projects.create({ name: "Race project" });
  const template = await owner.templates.create({ projectId: project.id, name: "Race" });
  const ids = { projectId: project.id, templateId: template.id };
  const save = (source: string) =>
    owner.templates.saveDraft({
      ...ids,
      source,
      schema: schemaA,
      sampleData: { name: "Ali" },
      renderTimeoutSec: 60,
      maxPayloadKb: 1024,
    });
  return { owner, ids, save, templateId: template.id };
}

describe("publish concurrency", () => {
  it("refuses to publish a draft that changed while it was being checked", async () => {
    const { owner, ids, save, templateId } = await setup();
    await save("#let checked = 1");
    env.PUBLISH_DRY_RUN = "on";
    hook.during = async () => {
      await save("#let UNCHECKED = 2");
    };
    try {
      const error = await owner.templates.publish(ids).then(
        () => null,
        (e: { code: string }) => e,
      );
      expect(error?.code).toBe("CONFLICT");
    } finally {
      hook.during = null;
      env.PUBLISH_DRY_RUN = "off";
    }
    // Nothing was published; the new content is still an editable draft.
    expect(await templatesRepository.findCurrent(templateId)).toBeNull();
    const draft = await templatesRepository.findDraft(templateId);
    expect(draft?.source).toBe("#let UNCHECKED = 2");
  });

  it("never lets a published version be rewritten, even through the repository", async () => {
    const { owner, ids, save } = await setup();
    await save("#let v = 1");
    const { version } = await owner.templates.publish(ids);
    const touched = await templatesRepository.updateDraft(version.id, { source: "#let hacked" });
    expect(touched).toBeNull();
    const [row] = await db
      .select()
      .from(schema.templateVersion)
      .where(eq(schema.templateVersion.id, version.id));
    expect(row?.source).toBe("#let v = 1");
  });
});
