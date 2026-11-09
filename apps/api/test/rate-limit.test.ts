import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/modules/v1/rate-limit";

describe("rate limiter", () => {
  it("allows the limit, then blocks with Retry-After, then refills", () => {
    let t = 0;
    const rl = createRateLimiter(() => t);
    const results = Array.from({ length: 4 }, () => rl.consume("k", 3));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[0]?.remaining).toBe(2);
    expect(results[3]).toMatchObject({ remaining: 0, retryAfterSec: 20 });
    t = 20_000; // 3/min => one token per 20 s
    expect(rl.consume("k", 3).ok).toBe(true);
    expect(rl.consume("k", 3).ok).toBe(false);
  });

  it("isolates keys and never exceeds capacity after idling", () => {
    let t = 0;
    const rl = createRateLimiter(() => t);
    rl.consume("a", 2);
    rl.consume("a", 2);
    expect(rl.consume("a", 2).ok).toBe(false);
    expect(rl.consume("b", 2).ok).toBe(true);
    t = 10 * 60_000;
    expect([rl.consume("a", 2).ok, rl.consume("a", 2).ok, rl.consume("a", 2).ok]).toEqual([
      true,
      true,
      false,
    ]);
  });
});
