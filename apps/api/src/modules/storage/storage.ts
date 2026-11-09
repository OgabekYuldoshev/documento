import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { env } from "../../config/env";

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Blob storage behind an interface so local disk can later be swapped for S3. */
export type Storage = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Absolute filesystem path (local storage only); callers stream from it. */
  getPath(key: string): string;
  remove(key: string): Promise<void>;
};

export function createLocalStorage(rootDir: string): Storage {
  const root = resolve(rootDir);

  function resolveKey(key: string): string {
    if (!KEY_PATTERN.test(key) || key.split("/").some((part) => part === "." || part === "..")) {
      throw new Error("invalid storage key");
    }
    const full = resolve(join(root, key));
    if (!full.startsWith(root + sep)) throw new Error("invalid storage key");
    return full;
  }

  return {
    async put(key, bytes) {
      const path = resolveKey(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    },
    getPath: resolveKey,
    async remove(key) {
      await rm(resolveKey(key), { force: true });
    },
  };
}

export const storage = createLocalStorage(env.STORAGE_DIR);
