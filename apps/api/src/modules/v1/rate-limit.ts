export type RateDecision = { ok: boolean; limit: number; remaining: number; retryAfterSec: number };

/** In-memory token bucket per key: capacity = per-minute limit, refilled continuously. */
export function createRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, { tokens: number; at: number; limit: number }>();

  return {
    consume(id: string, perMinute: number): RateDecision {
      const t = now();
      const prior = buckets.get(id);
      const ratePerMs = perMinute / 60_000;
      let tokens = perMinute;
      if (prior) {
        const grown = prior.tokens + (t - prior.at) * ratePerMs;
        tokens = Math.min(perMinute, grown);
      }
      if (tokens >= 1) {
        buckets.set(id, { tokens: tokens - 1, at: t, limit: perMinute });
        return { ok: true, limit: perMinute, remaining: Math.floor(tokens - 1), retryAfterSec: 0 };
      }
      buckets.set(id, { tokens, at: t, limit: perMinute });
      return {
        ok: false,
        limit: perMinute,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((1 - tokens) / ratePerMs / 1000)),
      };
    },
    /** Drops idle buckets (full for over a minute) so the map cannot grow without bound. */
    prune() {
      const t = now();
      for (const [id, b] of buckets) if (t - b.at > 120_000) buckets.delete(id);
    },
  };
}

export const rateLimiter = createRateLimiter();
setInterval(() => rateLimiter.prune(), 60_000).unref();
