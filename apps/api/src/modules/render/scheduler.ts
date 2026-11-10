/** `production` = real documents (API / queue); `interactive` = editor previews and dry-runs. */
export type RenderPriority = "production" | "interactive";

type Waiter = { memoryMb: number; start: () => void };

/**
 * Memory-budget scheduler: a job reserves its memory limit before running and waits until it
 * fits. Production work is always served before interactive work; inside one tier the order is
 * strict FIFO, so a large job at the head is never starved by small ones.
 */
export function createScheduler(budgetMb: number) {
  let inUse = 0;
  const queues: Record<RenderPriority, Waiter[]> = { production: [], interactive: [] };

  function pump() {
    for (;;) {
      const queue = queues.production.length > 0 ? queues.production : queues.interactive;
      const head = queue[0];
      if (!head || inUse + head.memoryMb > budgetMb) return;
      queue.shift();
      inUse += head.memoryMb;
      head.start();
    }
  }

  return {
    run<T>(
      memoryMb: number,
      task: () => Promise<T>,
      priority: RenderPriority = "production",
    ): Promise<T> {
      if (memoryMb > budgetMb) return Promise.reject(new Error("render_too_large"));
      return new Promise<T>((resolve, reject) => {
        queues[priority].push({
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
      return {
        inUseMb: inUse,
        queued: queues.production.length + queues.interactive.length,
      };
    },
  };
}
