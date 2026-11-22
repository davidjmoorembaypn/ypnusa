import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * Storage contracts for the two things Phase 1 moves to PostgreSQL. Callers depend on these
 * interfaces only; which store sits behind them is a deployment setting (@/lib/persistence/mode).
 *
 * Every method returns a promise, including in the data-file implementation, so a caller written
 * today keeps working unchanged when PostgreSQL takes over.
 */

/** What happened to the ZIP code in one `saveWithZipClaim` call. */
export interface ZipClaimOutcome {
  /** The subscription as stored: the ZIP code added on a claim, stripped on a conflict. */
  record: RevenueSubscriptionRecord;
  /** This call added the ZIP code to the subscription. */
  zipClaimed: boolean;
  /** Another holder already has the ZIP code. The subscription is saved without it. */
  zipConflict: boolean;
  /** The ZIP code went from open to locked. False for a same-holder transfer or replacement. */
  zipNewlyLocked: boolean;
}

export interface SaveOptions {
  /**
   * The plan as the caller read it before deciding this write, or null when it found none.
   * When given, the store that decides refuses the write with StaleWriteError if that plan has
   * changed since (for null: if a plan for the same Stripe subscription now exists), so two
   * events for one plan can never overwrite each other's work. The caller reads again and retries.
   *
   * The data file does not need this check: its read and write run without a pause in between,
   * so nothing can change the plan in the middle.
   */
  expected?: RevenueSubscriptionRecord | null;
}

export interface SubscriptionRepository {
  findById(id: string): Promise<RevenueSubscriptionRecord | null>;
  /** The lookup key for Stripe events. One customer can hold several subscriptions over time. */
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<RevenueSubscriptionRecord | null>;
  list(): Promise<RevenueSubscriptionRecord[]>;
  /**
   * Inserts or replaces by id, and returns the plan as stored. Makes no new ZIP code decision.
   * PostgreSQL, when it decides, stores a ZIP code the plan lists but another holder has taken
   * in the meantime as a conflict (zipLockConflict) rather than as held.
   */
  save(record: RevenueSubscriptionRecord, options?: SaveOptions): Promise<RevenueSubscriptionRecord>;
  /**
   * Inserts or replaces by id and, when `zip` is given, tries to lock it for this subscription
   * in the same atomic step, so two payments arriving together can never both get it.
   * The save always happens (the payment already succeeded); only the ZIP code can be refused.
   */
  saveWithZipClaim(record: RevenueSubscriptionRecord, zip: string | null, options?: SaveOptions): Promise<ZipClaimOutcome>;
  /** Data file only: save() that throws unless the change reached the disk. */
  saveDurably?(record: RevenueSubscriptionRecord): Promise<void>;
  /** Data file only: writes the whole store to disk now, or throws. */
  flushDurably?(): Promise<void>;
}

export interface TerritoryLedgerRepository {
  /** Every ZIP code held by a live paid plan (Stripe or admin adjustment) at `now`. */
  paidClaimedZips(now?: number): Promise<Set<string>>;
  isPaidClaimed(zip: string, now?: number): Promise<boolean>;
}
