export type GuardDecision = { blocked: false } | { blocked: true; retryAfterSec: number };

type Options = {
  /** Failures allowed per key inside the window before it locks. */
  maxFailures: number;
  windowMs: number;
  /** A single IP gets this many times the per-key budget (shared offices, NAT). */
  ipFactor?: number;
  now?: () => number;
};

/**
 * Failed-attempt throttle for sign-in, in memory (single instance, like the /v1 limiter).
 * Keys: the lower-cased email and the client IP. Both lock for the rest of the window once the
 * budget is spent; a successful sign-in clears the email key (not the IP key).
 */
export function createLoginGuard({ maxFailures, windowMs, ipFactor = 4, now = Date.now }: Options) {
  const failures = new Map<string, number[]>();

  const recent = (key: string) => {
    const t = now();
    const list = (failures.get(key) ?? []).filter((at) => t - at < windowMs);
    if (list.length) failures.set(key, list);
    else failures.delete(key);
    return list;
  };

  const status = (key: string, max: number): GuardDecision => {
    const list = recent(key);
    if (list.length < max) return { blocked: false };
    // Locked until the oldest counted failure leaves the window.
    const oldest = list[list.length - max] as number;
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now()) / 1000)),
    };
  };

  const emailKey = (email: string) => `e:${email.trim().toLowerCase()}`;
  const ipKey = (ip: string) => `i:${ip}`;

  return {
    check(email: string, ip: string): GuardDecision {
      const byEmail = status(emailKey(email), maxFailures);
      if (byEmail.blocked) return byEmail;
      return status(ipKey(ip), maxFailures * ipFactor);
    },
    fail(email: string, ip: string) {
      const t = now();
      for (const key of [emailKey(email), ipKey(ip)]) {
        failures.set(key, [...recent(key), t]);
      }
    },
    success(email: string) {
      failures.delete(emailKey(email));
    },
    prune() {
      for (const key of [...failures.keys()]) recent(key);
    },
  };
}
