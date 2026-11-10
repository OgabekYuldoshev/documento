/** In-process mutual exclusion per key: callers with the same key run one after another. */
export function createKeyedMutex() {
  const tails = new Map<string, Promise<void>>();

  return {
    async run<T>(key: string, work: () => Promise<T>): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      let release!: () => void;
      const mine = new Promise<void>((resolve) => {
        release = resolve;
      });
      const tail = previous.then(() => mine);
      tails.set(key, tail);
      await previous;
      try {
        return await work();
      } finally {
        release();
        if (tails.get(key) === tail) tails.delete(key);
      }
    },
  };
}
