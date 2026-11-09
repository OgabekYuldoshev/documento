type Waiter = { memoryMb: number; start: () => void };

/**
 * Memory-budget scheduler: a job reserves its memory limit before running and waits in a strict
 * FIFO queue until it fits. FIFO means a large job at the head is never starved by small ones.
 */
export function createScheduler(budgetMb: number) {
  let inUse = 0;
  const queue: Waiter[] = [];

  function pump() {
    while (queue.length > 0) {
      const head = queue[0] as Waiter;
      if (inUse + head.memoryMb > budgetMb) return;
      queue.shift();
      inUse += head.memoryMb;
      head.start();
    }
  }

  return {
    run<T>(memoryMb: number, task: () => Promise<T>): Promise<T> {
      if (memoryMb > budgetMb) return Promise.reject(new Error("render_too_large"));
      return new Promise<T>((resolve, reject) => {
        queue.push({
          memoryMb,
          start: () => {
            task()
              .then(resolve, reject)
              .finally(() => {
                inUse -= memoryMb;
                pump();
              });
          },
        });
        pump();
      });
    },
    get stats() {
      return { inUseMb: inUse, queued: queue.length };
    },
  };
}
