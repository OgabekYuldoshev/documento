import { BlockList, isIP } from "node:net";
import { env } from "../../config/env";

/** Addresses a webhook must never reach: loopback, private, link-local (cloud metadata), etc. */
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export const allowPrivate = () => env.WEBHOOK_ALLOW_PRIVATE === "on";

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged by its IPv4 part.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped?.[1]) return isPublicAddress(mapped[1]);
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export class UrlRejected extends Error {}

/** Static checks on the URL itself; DNS results are checked again at connect time. */
export function assertDeliverableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlRejected("Manzil noto'g'ri");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UrlRejected("Faqat http(s) manzil mumkin");
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new UrlRejected("Productionda faqat https manzil mumkin");
  }
  if (url.username || url.password) throw new UrlRejected("Manzilda login/parol bo'lmasin");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!allowPrivate()) {
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
      throw new UrlRejected("Ichki manzilga yuborib bo'lmaydi");
    }
    if (isIP(host) && !isPublicAddress(host)) {
      throw new UrlRejected("Ichki manzilga yuborib bo'lmaydi");
    }
  }
  return url;
}
