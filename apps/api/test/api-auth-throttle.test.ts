import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";

const bad = (ip: string) =>
  app.request("/v1/templates", {
    headers: {
      Authorization: `Bearer dk_live_${"a".repeat(8)}_${"b".repeat(48)}`,
      "X-Forwarded-For": ip,
    },
  });

describe("/v1 failed-authentication throttle", () => {
  it("answers 429 after too many invalid keys from one IP, without touching other IPs", async () => {
    for (let i = 0; i < env.API_AUTH_MAX_FAILURES; i++) {
      expect((await bad("203.0.113.7")).status).toBe(401);
    }
    const blocked = await bad("203.0.113.7");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(blocked.headers.get("content-type")).toContain("application/problem+json");

    expect((await bad("203.0.113.8")).status).toBe(401);
  });
});
