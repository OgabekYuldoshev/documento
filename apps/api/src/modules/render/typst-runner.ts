import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../../config/env";
import { type Diagnostic, parseDiagnostics } from "./diagnostics";

export type RenderJob = {
  source: string;
  data: unknown;
  timeoutSec: number;
  memoryMb: number;
  /** Template files, exposed to Typst as `assets/<name>` (fonts are also added as font paths). */
  assets?: { name: string; kind: "image" | "font"; path: string }[];
  /** Treat Typst warnings (e.g. unknown font) as failures. */
  strictWarnings?: boolean;
};

export type RenderResult =
  | {
      status: "ok";
      pdfPath: string;
      bytes: number;
      pages: number;
      durationMs: number;
      diagnostics: Diagnostic[];
      dispose(): Promise<void>;
    }
  | {
      status: "error" | "timeout" | "oom";
      diagnostics: Diagnostic[];
      durationMs: number;
      dispose(): Promise<void>;
    };

const MAX_STDERR = 64 * 1024;
const PRLIMIT = "prlimit";
// Allowlist is empty: any @namespace/package import would make Typst download from the internet.
const PACKAGE_IMPORT = /["']@[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+(?::[^"']*)?["']/;

let prlimitAvailable: boolean | undefined;
function hasPrlimit(): boolean {
  if (prlimitAvailable === undefined) {
    prlimitAvailable = spawnSync(PRLIMIT, ["--version"]).status === 0;
    if (!prlimitAvailable) {
      console.warn("[render] prlimit not found: Typst memory limit is NOT enforced");
    }
  }
  return prlimitAvailable;
}

/** Counts `/Type /Page` objects by streaming, so large PDFs are never held in memory. */
export async function countPages(path: string): Promise<number> {
  const overlap = 16;
  let tail = "";
  let pages = 0;
  for await (const chunk of createReadStream(path)) {
    const text = tail + (chunk as Buffer).toString("latin1");
    for (const m of text.matchAll(/\/Type\s*\/Page[^s]/g)) {
      if (m.index + m[0].length > tail.length) pages++;
    }
    tail = text.slice(-overlap);
  }
  return pages;
}

export async function runTypst(job: RenderJob): Promise<RenderResult> {
  const dir = await mkdtemp(join(tmpdir(), "documento-render-"));
  const dispose = () => rm(dir, { recursive: true, force: true });
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const fail = (status: "error" | "timeout" | "oom", diagnostics: Diagnostic[]): RenderResult => ({
    status,
    diagnostics,
    durationMs: elapsed(),
    dispose,
  });

  if (PACKAGE_IMPORT.test(job.source)) {
    return fail("error", [
      {
        severity: "error",
        message: "Tashqi paketlarni (@namespace/...) import qilish taqiqlangan",
      },
    ]);
  }

  const pdfPath = join(dir, "out.pdf");
  const empty = join(dir, ".empty");
  await mkdir(empty);
  await writeFile(join(dir, "main.typ"), job.source);
  await writeFile(join(dir, "data.json"), JSON.stringify(job.data ?? {}));

  const fontsDir = join(dir, "fonts");
  const assets = job.assets ?? [];
  if (assets.length > 0) await mkdir(join(dir, "assets"));
  if (assets.some((a) => a.kind === "font")) await mkdir(fontsDir);
  for (const asset of assets) {
    await copyFile(asset.path, join(dir, asset.kind === "font" ? "fonts" : "assets", asset.name));
    if (asset.kind === "font") await copyFile(asset.path, join(dir, "assets", asset.name));
  }

  const typstArgs = [
    "compile",
    "--root",
    dir,
    "--ignore-system-fonts",
    ...(existsSync(env.FONTS_DIR) ? ["--font-path", env.FONTS_DIR] : []),
    ...(assets.some((a) => a.kind === "font") ? ["--font-path", fontsDir] : []),
    "--package-path",
    empty,
    "--package-cache-path",
    empty,
    "--diagnostic-format",
    "short",
    join(dir, "main.typ"),
    pdfPath,
  ];
  const limited = hasPrlimit();
  const cmd = limited ? PRLIMIT : env.TYPST_BIN;
  const args = limited
    ? [`--as=${job.memoryMb * 1024 * 1024}`, `--cpu=${job.timeoutSec}`, env.TYPST_BIN, ...typstArgs]
    : typstArgs;

  const outcome = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    stderr: string;
    timedOut: boolean;
    spawnError?: string;
  }>((resolve) => {
    const child = spawn(cmd, args, {
      cwd: dir,
      detached: true, // own process group, so the timeout kills prlimit and typst together
      stdio: ["ignore", "ignore", "pipe"],
      env: {
        PATH: process.env.PATH ?? "/usr/bin:/bin",
        HOME: dir,
        TMPDIR: dir,
        XDG_CACHE_HOME: join(dir, ".cache"),
        HTTPS_PROXY: "http://127.0.0.1:1",
        HTTP_PROXY: "http://127.0.0.1:1",
      },
    });
    let stderr = "";
    let timedOut = false;
    let spawnError: string | undefined;
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < MAX_STDERR) stderr += d.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        // already gone
      }
    }, job.timeoutSec * 1000);
    child.on("error", (e) => {
      spawnError = e.message;
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stderr, timedOut, spawnError });
    });
  });

  if (outcome.spawnError) {
    return fail("error", [{ severity: "error", message: "Typst ishga tushmadi" }]);
  }
  const diagnostics = parseDiagnostics(outcome.stderr, dir);
  if (outcome.timedOut) {
    return fail("timeout", [
      ...diagnostics,
      { severity: "error", message: `Render ${job.timeoutSec} soniyada tugamadi` },
    ]);
  }
  const killed = outcome.signal !== null || outcome.code === 134 || outcome.code === 137;
  if (killed || /memory allocation/.test(outcome.stderr)) {
    return fail("oom", [
      ...diagnostics,
      { severity: "error", message: `Xotira limiti (${job.memoryMb} MB) yetmadi` },
    ]);
  }
  const hasError = outcome.code !== 0 || diagnostics.some((d) => d.severity === "error");
  const strictFail = job.strictWarnings && diagnostics.some((d) => d.severity === "warning");
  if (hasError || strictFail || !existsSync(pdfPath)) {
    const fallback: Diagnostic[] = diagnostics.length
      ? diagnostics
      : [{ severity: "error", message: "Kompilyatsiya xatosi" }];
    return fail("error", fallback);
  }
  return {
    status: "ok",
    pdfPath,
    bytes: (await stat(pdfPath)).size,
    pages: await countPages(pdfPath),
    durationMs: elapsed(),
    diagnostics,
    dispose,
  };
}
