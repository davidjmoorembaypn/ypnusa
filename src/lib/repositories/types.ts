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

export interface SubscriptionRepository {
  findById(id: string): Promise<RevenueSubscriptionRecord | null>;
  /** The lookup key for Stripe events. One customer can hold several subscriptions over time. */
  findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<RevenueSubscriptionRecord | null>;
  list(): Promise<RevenueSubscriptionRecord[]>;
  /** Inserts or replaces by id. Makes no ZIP code decision. */
  save(record: RevenueSubscriptionRecord): Promise<void>;
  /**
   * Inserts or replaces by id and, when `zip` is given, tries to lock it for this subscription
   * in the same atomic step, so two payments arriving together can never both get it.
   * The save always happens (the payment already succeeded); only the ZIP code can be refused.
   */
  saveWithZipClaim(record: RevenueSubscriptionRecord, zip: string | null): Promise<ZipClaimOutcome>;
}

export interface TerritoryLedgerRepository {
  /** Every ZIP code held by a live paid plan (Stripe or admin adjustment) at `now`. */
  paidClaimedZips(now?: number): Promise<Set<string>>;
  isPaidClaimed(zip: string, now?: number): Promise<boolean>;
  /**
   * Who holds each paid ZIP code at `now`: ZIP code to holder keys (see claimHolderKey), sorted.
   * More than one holder for a ZIP code is data that breaks the rule; the comparison between
   * stores uses this to notice it.
   */
  paidHolders(now?: number): Promise<Map<string, string[]>>;
}
