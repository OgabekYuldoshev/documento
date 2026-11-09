import { spawnSync } from "node:child_process";
import type { TemplateSchema } from "@documento/shared";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { renderPreview, runPublishDryRun } from "../src/modules/render/render.service";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;

const schema: TemplateSchema = { fields: [{ name: "name", type: "string", required: true }] };
const source = '#let data = json("data.json")\nSalom, #data.name!';
const version = (over: Partial<{ source: string; sampleData: unknown }> = {}) => ({
  source,
  schema,
  sampleData: { name: "Ali" },
  renderTimeoutSec: 20,
  maxPayloadKb: 64,
  ...over,
});

describe.skipIf(!hasTypst)("render service", () => {
  it("renders valid data to a PDF", async () => {
    const r = await renderPreview({ source, schema, data: { name: "Ali" }, timeoutSec: 20 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(r.pages).toBe(1);
    }
  });

  it("returns validation errors instead of crashing Typst", async () => {
    const r = await renderPreview({ source, schema, data: { nope: 1 }, timeoutSec: 20 });
    expect(r).toMatchObject({ ok: false, kind: "validation" });
  });

  it("publish dry-run passes for a good template", async () => {
    await expect(runPublishDryRun(version())).resolves.toBeUndefined();
  });

  it("publish dry-run reports Typst errors with line numbers", async () => {
    await expect(runPublishDryRun(version({ source: "line one\n#let x = (" }))).rejects.toThrow(
      /main\.typ:\d+:\d+/,
    );
  });

  it("publish dry-run blocks unknown fonts and invalid sample data", async () => {
    await expect(
      runPublishDryRun(version({ source: '#set text(font: "NoSuchFont")\nHi' })),
    ).rejects.toThrow(/font/i);
    await expect(runPublishDryRun(version({ sampleData: {} }))).rejects.toThrow(/\/name/);
  });
});
