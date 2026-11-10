/**
 * In-process "job finished" signal so sync-wait callers wake up the moment the queue records a
 * final status instead of polling the DB. Single instance only (like the queue itself); callers
 * still re-check the row on a slow timer in case a signal is missed.
 */
const waiters = new Map<string, Set<() => void>>();

export function notifyJobFinished(id: string): void {
  const set = waiters.get(id);
  if (!set) return;
  waiters.delete(id);
  for (const wake of set) wake();
}

/** Resolves when `id` is signalled or after `ms`, whichever comes first. */
export function waitForJobSignal(
  id: string,
  ms: number,
): { promise: Promise<void>; cancel(): void } {
  let wake: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      const set = waiters.get(id);
      if (set) {
        set.delete(done);
        if (set.size === 0) waiters.delete(id);
      }
      resolve();
    }
    wake = done;
    const set = waiters.get(id) ?? new Set<() => void>();
    waiters.set(id, set);
    set.add(done);
  });
  return { promise, cancel: () => wake() };
}
