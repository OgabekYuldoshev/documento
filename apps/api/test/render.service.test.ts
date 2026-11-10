import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TemplateSchema } from "@documento/shared";
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { previewsService } from "../src/modules/previews/previews.service";
import {
  renderPreview,
  renderPreviewSvg,
  runPublishDryRun,
} from "../src/modules/render/render.service";
import { solidPng } from "./png";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;

const schema: TemplateSchema = {
  type: "object",
  properties: { name: { type: "string" } },
  required: ["name"],
  additionalProperties: false,
};
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

  it("renders one SVG per page for the editor preview, in page order", async () => {
    const paged =
      '#let data = json("data.json")\n#data.name\n#pagebreak()\nIkkinchi\n#pagebreak()\nUchinchi';
    const r = await renderPreviewSvg("user-1", {
      source: paged,
      schema,
      data: { name: "Ali" },
      timeoutSec: 20,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pages).toBe(3);
      // Pages are stored per owner and served one by one.
      for (const n of [1, 2, 3]) {
        const path = await previewsService.pagePath("user-1", r.previewId, n);
        expect(path).not.toBeNull();
        expect(readFileSync(path as string, "utf8")).toContain("<svg");
      }
      expect(await previewsService.pagePath("user-1", r.previewId, 4)).toBeNull();
      expect(await previewsService.pagePath("someone-else", r.previewId, 1)).toBeNull();
    }
  });

  it("reports Typst errors for the SVG preview too", async () => {
    const r = await renderPreviewSvg("user-1", {
      source: "#let x = (",
      schema,
      data: { name: "Ali" },
      timeoutSec: 20,
    });
    expect(r).toMatchObject({ ok: false, kind: "compile" });
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

  it("exposes template images as assets/<name>", async () => {
    const dir = mkdtempSync(join(tmpdir(), "asset-test-"));
    const path = join(dir, "logo.png");
    writeFileSync(path, solidPng(30, 30));
    const r = await renderPreview({
      source: '#image("assets/logo.png", width: 20mm)',
      schema,
      data: { name: "x" },
      timeoutSec: 20,
      strictWarnings: true,
      assets: [{ name: "logo.png", kind: "image", path }],
    });
    expect(r.ok).toBe(true);
    const missing = await renderPreview({
      source: '#image("assets/none.png")',
      schema,
      data: { name: "x" },
      timeoutSec: 20,
    });
    expect(missing.ok).toBe(false);
  });
});
