import { describe, expect, it } from "vitest";
import { createInFlightLimiter } from "../src/lib/in-flight-limiter";

const gate = () => {
  let open!: () => void;
  const promise = new Promise<void>((r) => {
    open = r;
  });
  return { promise, open };
};

describe("in-flight limiter", () => {
  it("rejects work beyond the per-key limit and frees the slot when work ends", async () => {
    const limiter = createInFlightLimiter(2, "Juda ko'p");
    const g = gate();
    const a = limiter.run("u1", () => g.promise);
    const b = limiter.run("u1", () => g.promise);
    const refused = await limiter.run("u1", async () => "x").catch((e) => e);
    expect(refused).toMatchObject({ code: "TOO_MANY_REQUESTS", message: "Juda ko'p" });

    // Other keys are independent.
    await expect(limiter.run("u2", async () => "ok")).resolves.toBe("ok");

    g.open();
    await Promise.all([a, b]);
    await expect(limiter.run("u1", async () => "again")).resolves.toBe("again");
  });

  it("releases the slot when the work throws", async () => {
    const limiter = createInFlightLimiter(1, "Juda ko'p");
    await limiter.run("u1", async () => Promise.reject(new Error("boom"))).catch(() => {});
    await expect(limiter.run("u1", async () => "ok")).resolves.toBe("ok");
    expect(limiter.size).toBe(0);
  });
});
