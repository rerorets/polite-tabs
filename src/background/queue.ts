const DRAG_ERROR = 'Tabs cannot be edited right now';
const MAX_RETRIES = 5;

let chain: Promise<void> = Promise.resolve();

/**
 * Runs tasks one at a time. Grouping reads state, then writes it; running two tabs
 * through that in parallel is what used to create one group per tab.
 *
 * While the user drags a tab Chrome rejects edits, so such tasks are retried later
 * instead of fighting the drag.
 */
export const enqueue = (task: () => Promise<void>, attempt = 0): Promise<void> => {
  const run = chain.then(task).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(DRAG_ERROR) && attempt < MAX_RETRIES) {
      setTimeout(() => void enqueue(task, attempt + 1), 250 * (attempt + 1));
      return;
    }
    console.error(error);
  });
  chain = run;
  return run;
};

/** Collapses bursts of calls with the same key into one call after `wait` ms of quiet. */
export const debounceByKey = <K>(wait: number, fn: (key: K) => void) => {
  const timers = new Map<K, ReturnType<typeof setTimeout>>();
  return (key: K) => {
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn(key);
      }, wait)
    );
  };
};
