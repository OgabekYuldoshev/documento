import { TRPCError } from "@trpc/server";

/**
 * Caps how many calls per key (e.g. user id) may be running at once; extra calls are refused
 * right away instead of piling up behind a shared resource. In-memory, single instance.
 */
export function createInFlightLimiter(max: number, message: string) {
  const active = new Map<string, number>();

  return {
    async run<T>(key: string, work: () => Promise<T>): Promise<T> {
      const n = active.get(key) ?? 0;
      if (n >= max) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message });
      active.set(key, n + 1);
      try {
        return await work();
      } finally {
        const left = (active.get(key) ?? 1) - 1;
        if (left <= 0) active.delete(key);
        else active.set(key, left);
      }
    },
    get size() {
      return active.size;
    },
  };
}
