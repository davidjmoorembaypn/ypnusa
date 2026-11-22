import { StaleWriteError } from "./subscription-record";

/**
 * Keeps the read-decide-write of one paid plan from overlapping with another event for the
 * same plan (keyed by its Stripe subscription id).
 *
 *   onePlanAtATime  Within this process, events for one plan run one after the other.
 *   retryStaleWrites  Across processes, the store in charge refuses a write decided from an
 *                     outdated copy (StaleWriteError, see SaveOptions.expected); the event is
 *                     then read and decided again.
 *
 * On the data file neither ever changes the outcome: its read and write already cannot overlap.
 */

// Shared across every copy of this module the server may load (each route bundle gets its own).
const KEY = Symbol.for("ypnusa.planQueues");
const holder = globalThis as unknown as Record<symbol, Map<string, Promise<unknown>> | undefined>;
const queues: Map<string, Promise<unknown>> = (holder[KEY] ??= new Map());

export function onePlanAtATime<T>(planKey: string | null | undefined, task: () => Promise<T>): Promise<T> {
  if (!planKey) return task();
  const previous = queues.get(planKey) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(planKey, tail);
  void tail.then(() => {
    if (queues.get(planKey) === tail) queues.delete(planKey);
  });
  return run;
}

export const STALE_WRITE_ATTEMPTS = 3;

export async function retryStaleWrites<T>(task: () => Promise<T>, attempts: number = STALE_WRITE_ATTEMPTS): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (!(error instanceof StaleWriteError) || attempt >= attempts) throw error;
    }
  }
}
