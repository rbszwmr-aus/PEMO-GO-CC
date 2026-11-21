/**
 * Loads a live resource and cancels the previous in-flight request when a
 * newer one starts (estate / account switch). A stale response cannot
 * restore the previous scope's data.
 */
export interface CancellableLoad<T> {
  load(run: (signal: AbortSignal) => Promise<T>): Promise<T>;
  abort(): void;
}

export const createCancellableLoader = <T>(): CancellableLoad<T> => {
  let generation = 0;
  let current: AbortController | undefined;
  return {
    abort() {
      current?.abort();
      current = undefined;
    },
    async load(run) {
      current?.abort();
      const mine = ++generation;
      const controller = new AbortController();
      current = controller;
      try {
        const value = await run(controller.signal);
        if (mine !== generation || controller.signal.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        }
        return value;
      } finally {
        if (current === controller) current = undefined;
      }
    },
  };
};
