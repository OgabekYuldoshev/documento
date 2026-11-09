import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_PATTERN = /^dk_live_([0-9a-f]{8})_([0-9a-f]{48})$/;

export const hashKey = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function generateKey() {
  const prefix = randomBytes(4).toString("hex");
  const raw = `dk_live_${prefix}_${randomBytes(24).toString("hex")}`;
  return { raw, prefix, hash: hashKey(raw) };
}

/** Prefix of a well-formed key, or null (malformed keys never reach the database). */
export function parseKeyPrefix(raw: string): string | null {
  return KEY_PATTERN.exec(raw)?.[1] ?? null;
}

export function hashMatches(raw: string, storedHash: string): boolean {
  const a = Buffer.from(hashKey(raw), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
