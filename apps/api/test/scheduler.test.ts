import { describe, expect, it } from "vitest";
import { createScheduler } from "../src/modules/render/scheduler";

const gate = () => {
  let open!: () => void;
  const promise = new Promise<void>((r) => {
    open = r;
  });
  return { promise, open };
};
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("scheduler", () => {
  it("never exceeds the budget and runs FIFO", async () => {
    const s = createScheduler(1000);
    const order: string[] = [];
    let inFlight = 0;
    let peak = 0;
    const gates = [gate(), gate(), gate()];
    const job = (name: string, mb: number, g: ReturnType<typeof gate>) =>
      s.run(mb, async () => {
        order.push(name);
        inFlight += mb;
        peak = Math.max(peak, inFlight);
        await g.promise;
        inFlight -= mb;
      });
    const a = job("a", 600, gates[0] as ReturnType<typeof gate>);
    const b = job("b", 600, gates[1] as ReturnType<typeof gate>);
    const c = job("c", 300, gates[2] as ReturnType<typeof gate>);
    await tick();
    expect(order).toEqual(["a"]); // b does not fit; c waits behind b (FIFO)
    expect(s.stats).toEqual({ inUseMb: 600, queued: 2 });
    gates[0]?.open();
    await a;
    await tick();
    expect(order).toEqual(["a", "b", "c"]); // 600 + 300 fit together
    gates[1]?.open();
    gates[2]?.open();
    await Promise.all([b, c]);
    expect(peak).toBeLessThanOrEqual(1000);
    expect(s.stats).toEqual({ inUseMb: 0, queued: 0 });
  });

  it("releases the budget when a task fails", async () => {
    const s = createScheduler(500);
    await expect(s.run(500, () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(s.run(500, async () => "ok")).resolves.toBe("ok");
  });

  it("rejects jobs larger than the budget", async () => {
    const s = createScheduler(500);
    await expect(s.run(501, async () => 1)).rejects.toThrow("render_too_large");
    expect(s.stats.queued).toBe(0);
  });

  it("a large queued job runs once small ones finish", async () => {
    const s = createScheduler(1000);
    const g = gate();
    const small = s.run(400, () => g.promise);
    const big = s.run(900, async () => "big");
    await tick();
    expect(s.stats.queued).toBe(1);
    g.open();
    await small;
    await expect(big).resolves.toBe("big");
  });
});
