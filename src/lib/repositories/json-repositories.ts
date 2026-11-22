import {
  findRevenueSubscriptionByStripeSubscriptionId,
  flushDbDurably,
  readDb,
  saveRevenueSubscription,
  saveRevenueSubscriptionDurably,
  saveRevenueSubscriptionWithZipClaim,
} from "@/lib/db";
import { paidLedgerClaimedZipsFromDataFile } from "@/lib/territory";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import type { SaveOptions, SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";

/**
 * The data file (store.json) behind the repository contracts. These are the same functions the
 * app has always called, so choosing this implementation changes nothing. It stays in place for
 * the whole move as the fallback and as the copy a rollback returns to.
 *
 * Each method does its work before it returns its promise: the data file's writes are
 * synchronous and atomic under its own lock.
 */
export class JsonSubscriptionRepository implements SubscriptionRepository {
  async findById(id: string): Promise<RevenueSubscriptionRecord | null> {
    return readDb().revenueSubscriptions.find((subscription) => subscription.id === id) ?? null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<RevenueSubscriptionRecord | null> {
    return findRevenueSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  }

  async list(): Promise<RevenueSubscriptionRecord[]> {
    return readDb().revenueSubscriptions;
  }

  // `options.expected` is not needed here (see SaveOptions): the data file's read and write
  // cannot be interleaved, and its behaviour stays exactly as it always was.
  async save(record: RevenueSubscriptionRecord, _options?: SaveOptions): Promise<RevenueSubscriptionRecord> {
    saveRevenueSubscription(record);
    return record;
  }

  async saveWithZipClaim(record: RevenueSubscriptionRecord, zip: string | null, _options?: SaveOptions): Promise<ZipClaimOutcome> {
    return saveRevenueSubscriptionWithZipClaim(record, zip);
  }

  /** Used only for copies of what PostgreSQL decided: never reports a write that stayed in memory. */
  async saveDurably(record: RevenueSubscriptionRecord): Promise<void> {
    saveRevenueSubscriptionDurably(record);
  }

  async flushDurably(): Promise<void> {
    flushDbDurably();
  }
}

export class JsonTerritoryLedgerRepository implements TerritoryLedgerRepository {
  async paidClaimedZips(now: number = Date.now()): Promise<Set<string>> {
    return paidLedgerClaimedZipsFromDataFile(now);
  }

  async isPaidClaimed(zip: string, now: number = Date.now()): Promise<boolean> {
    return paidLedgerClaimedZipsFromDataFile(now).has(zip);
  }
}
