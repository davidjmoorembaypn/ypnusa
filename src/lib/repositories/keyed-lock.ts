/**
 * Runs pieces of work that share a key one after another, in the order they arrived.
 *
 * Why: applying a Stripe event reads a subscription, decides, then writes it. With PostgreSQL
 * those steps are separate trips to the database, so two events for the same subscription
 * arriving together (Stripe sends "checkout completed" and "subscription created" within the
 * same second) could both read "no such subscription" and both create one. Holding this lock
 * for the whole read-decide-write makes the second event see what the first one wrote.
 *
 * This is a lock inside one server process, which is what Phase 1 runs on. Running more than one
 * server needs the same guarantee from the database and is part of Phase 2.
 */

// Shared across every copy of this module the server may load (each route can get its own).
const KEY = Symbol.for("ypnusa.keyedLocks");
const holder = globalThis as unknown as Record<symbol, Map<string, Promise<void>> | undefined>;
const tails: Map<string, Promise<void>> = (holder[KEY] ??= new Map());

export async function withKeyedLock<T>(key: string, work: () => Promise<T>): Promise<T> {
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
}

/** The lock key for everything that reads and then writes one subscription. */
export function subscriptionLockKey(stripeSubscriptionIdOrRecordId: string): string {
  return `subscription:${stripeSubscriptionIdOrRecordId}`;
}
