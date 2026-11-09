import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env";
import { parseDiagnostics } from "../src/modules/render/diagnostics";
import { type RenderResult, runTypst } from "../src/modules/render/typst-runner";

const hasTypst = spawnSync(env.TYPST_BIN, ["--version"]).status === 0;
const base = { data: {}, timeoutSec: 20, memoryMb: 1024 };

describe("parseDiagnostics", () => {
  it("parses positions, strips work dir and ignores noise", () => {
    const d = parseDiagnostics(
      '/tmp/w/main.typ:2:6: error: dictionary does not contain key "x"\nrandom\nwarning: bare\n',
      "/tmp/w",
    );
    expect(d).toEqual([
      {
        severity: "error",
        file: "main.typ",
        line: 2,
        column: 6,
        message: 'dictionary does not contain key "x"',
      },
      { severity: "warning", message: "bare" },
    ]);
  });

  it("never throws on garbage", () => {
    expect(parseDiagnostics("\u0000\n:::\nerror:\n")).toEqual([]);
  });
});

describe.skipIf(!hasTypst)("runTypst", () => {
  const results: RenderResult[] = [];
  const run = async (source: string, extra: Partial<Parameters<typeof runTypst>[0]> = {}) => {
    const r = await runTypst({ ...base, source, ...extra });
    results.push(r);
    return r;
  };
  afterEach(async () => {
    await Promise.all(results.splice(0).map((r) => r.dispose()));
  });

  it("compiles and counts pages", async () => {
    const r = await run("Salom\n#pagebreak()\nDunyo");
    expect(r.status).toBe("ok");
    if (r.status === "ok") {
      expect(r.pages).toBe(2);
      expect(r.bytes).toBeGreaterThan(100);
    }
  });

  it("reads data.json", async () => {
    const r = await run('#let data = json("data.json")\n#data.name', { data: { name: "Ali" } });
    expect(r.status).toBe("ok");
  });

  it("reports syntax errors with position", async () => {
    const r = await run("#let x = (");
    expect(r.status).toBe("error");
    expect(r.diagnostics[0]).toMatchObject({ severity: "error", file: "main.typ" });
    expect(r.diagnostics[0]?.line).toBeGreaterThan(0);
  });

  it.each(['#read("../../etc/hosts")', '#read("/etc/passwd")'])("blocks %s", async (src) => {
    const r = await run(src);
    expect(r.status).toBe("error");
  });

  it("rejects package imports without touching the network", async () => {
    const t = performance.now();
    const r = await run('#import "@preview/cetz:0.3.4": canvas');
    expect(r.status).toBe("error");
    expect(r.diagnostics[0]?.message).toContain("taqiqlangan");
    expect(performance.now() - t).toBeLessThan(1000);
  });

  it("kills runaway jobs on timeout", async () => {
    const t = performance.now();
    const r = await run("#range(2000000000).map(x => x * 2).len()", {
      timeoutSec: 2,
      memoryMb: 8192,
    });
    expect(["timeout", "oom", "error"]).toContain(r.status);
    expect(performance.now() - t).toBeLessThan(6000);
  });

  it("treats unknown fonts as errors only in strict mode", async () => {
    const src = '#set text(font: "NoSuchFontFamily")\nHi';
    expect((await run(src)).status).toBe("ok");
    const strict = await run(src, { strictWarnings: true });
    expect(strict.status).toBe("error");
    expect(strict.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("removes the work dir on dispose", async () => {
    const r = await run("x");
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(existsSync(r.pdfPath)).toBe(true);
    await r.dispose();
    expect(existsSync(r.pdfPath)).toBe(false);
  });
});
