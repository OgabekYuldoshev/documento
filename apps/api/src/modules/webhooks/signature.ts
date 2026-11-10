import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-documento-signature";

export const generateSecret = () => `whsec_${randomBytes(24).toString("base64url")}`;

/** `v1` = HMAC-SHA256 over `"<timestamp>.<raw body>"`, hex. The timestamp defeats replays. */
export function sign(secret: string, body: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** Reference verifier (also used by tests); receivers implement the same steps. */
export function verify(
  secret: string,
  body: string,
  header: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = Buffer.from(sign(secret, body, t).split("v1=")[1] ?? "", "hex");
  const given = Buffer.from(parts.v1, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
