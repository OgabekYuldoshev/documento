import { describe, expect, it } from "vitest";
import { createLoginGuard } from "../src/modules/auth/login-guard";

function setup() {
  let t = 1_000_000;
  const guard = createLoginGuard({ maxFailures: 3, windowMs: 60_000, now: () => t });
  return { guard, advance: (ms: number) => (t += ms) };
}

describe("login guard", () => {
  it("allows attempts until the failure budget is spent, then locks", () => {
    const { guard } = setup();
    for (let i = 0; i < 3; i++) {
      expect(guard.check("a@x.uz", "1.1.1.1").blocked).toBe(false);
      guard.fail("a@x.uz", "1.1.1.1");
    }
    const decision = guard.check("a@x.uz", "2.2.2.2");
    expect(decision.blocked).toBe(true);
    if (decision.blocked) expect(decision.retryAfterSec).toBeGreaterThan(0);
  });

  it("treats emails case-insensitively and leaves other emails alone", () => {
    const { guard } = setup();
    for (let i = 0; i < 3; i++) guard.fail("A@X.uz", "1.1.1.1");
    expect(guard.check("a@x.uz", "9.9.9.9").blocked).toBe(true);
    expect(guard.check("b@x.uz", "9.9.9.9").blocked).toBe(false);
  });

  it("unlocks after the window and on success", () => {
    const { guard, advance } = setup();
    for (let i = 0; i < 3; i++) guard.fail("a@x.uz", "1.1.1.1");
    advance(61_000);
    expect(guard.check("a@x.uz", "1.1.1.1").blocked).toBe(false);

    for (let i = 0; i < 2; i++) guard.fail("a@x.uz", "1.1.1.1");
    guard.success("a@x.uz");
    guard.fail("a@x.uz", "3.3.3.3");
    expect(guard.check("a@x.uz", "3.3.3.3").blocked).toBe(false);
  });

  it("locks an IP that sprays many emails (4x budget)", () => {
    const { guard } = setup();
    for (let i = 0; i < 12; i++) guard.fail(`u${i}@x.uz`, "6.6.6.6");
    expect(guard.check("fresh@x.uz", "6.6.6.6").blocked).toBe(true);
    expect(guard.check("fresh@x.uz", "7.7.7.7").blocked).toBe(false);
  });
});
