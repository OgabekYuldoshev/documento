import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { env } from "../../config/env";

/**
 * Editor preview pages live on disk, not in the tRPC response: long documents (hundreds of
 * pages with images) do not fit a JSON body. Each preview is a folder `<id>/{1..n}.svg` plus
 * `owner` (user id). The id is unguessable and the route also checks the owner.
 */
const ROOT = join(env.STORAGE_DIR, "previews");
const TTL_MS = 15 * 60_000;
const KEEP_PER_USER = 3;
export const PREVIEW_MAX_TOTAL_BYTES = 400 * 1024 * 1024;

const ID = /^[0-9a-f-]{36}$/;
const dirOf = (id: string) => join(ROOT, id);

async function ownerOf(id: string): Promise<string | null> {
  try {
    return (await readFile(join(dirOf(id), "owner"), "utf8")).trim();
  } catch {
    return null;
  }
}

export const previewsService = {
  /** Copies rendered page SVGs into a new preview and trims the user's older ones. */
  async create(userId: string, svgPaths: string[]): Promise<string> {
    const id = crypto.randomUUID();
    const dir = dirOf(id);
    await mkdir(dir, { recursive: true });
    try {
      await writeFile(join(dir, "owner"), userId);
      await Promise.all(svgPaths.map((p, i) => copyFile(p, join(dir, `${i + 1}.svg`))));
    } catch (error) {
      await rm(dir, { recursive: true, force: true });
      throw error;
    }
    await this.trim(userId);
    return id;
  },

  /** Page file path when `userId` owns the preview and the page exists. */
  async pagePath(userId: string, id: string, page: number): Promise<string | null> {
    if (!ID.test(id) || !Number.isInteger(page) || page < 1) return null;
    if ((await ownerOf(id)) !== userId) return null;
    const path = join(dirOf(id), `${page}.svg`);
    try {
      await stat(path);
      return path;
    } catch {
      return null;
    }
  },

  /** Keeps only the user's newest previews (several tabs may edit at once). */
  async trim(userId: string) {
    const mine: { id: string; at: number }[] = [];
    for (const id of await readdir(ROOT).catch(() => [])) {
      if ((await ownerOf(id)) !== userId) continue;
      mine.push({ id, at: (await stat(dirOf(id))).mtimeMs });
    }
    mine.sort((a, b) => b.at - a.at);
    for (const old of mine.slice(KEEP_PER_USER)) {
      await rm(dirOf(old.id), { recursive: true, force: true });
    }
  },

  async cleanExpired() {
    const cutoff = Date.now() - TTL_MS;
    for (const id of await readdir(ROOT).catch(() => [])) {
      const info = await stat(dirOf(id)).catch(() => null);
      if (info && info.mtimeMs < cutoff) await rm(dirOf(id), { recursive: true, force: true });
    }
  },
};

/** Boot hook: sweep every 5 minutes. */
export function startPreviewCleaner() {
  const run = () =>
    previewsService.cleanExpired().catch((e) => console.error("[previews] cleanup failed", e));
  void run();
  const timer = setInterval(run, 5 * 60_000);
  timer.unref();
}
