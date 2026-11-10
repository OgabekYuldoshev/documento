import { env } from "../../config/env";
import { createLoginGuard } from "../auth/login-guard";

/**
 * Failed-key throttle per client IP for `/v1` (in memory, single instance). Without it anyone can
 * hammer the key lookup with wrong keys; valid keys are still limited per key by the rate limiter.
 * Requests whose IP is unknown (no proxy header) are not throttled, so they cannot lock each
 * other out.
 */
const guard = createLoginGuard({
  maxFailures: env.API_AUTH_MAX_FAILURES,
  windowMs: 60_000,
  ipFactor: 1,
});
setInterval(() => guard.prune(), 5 * 60_000).unref();

export const authThrottle = {
  check: (ip: string) => (ip === "unknown" ? ({ blocked: false } as const) : guard.check(ip, ip)),
  fail: (ip: string) => {
    if (ip !== "unknown") guard.fail(ip, ip);
  },
};
