import {
  findRevenueSubscriptionByStripeSubscriptionId,
  readDb,
  saveRevenueSubscription,
  saveRevenueSubscriptionWithZipClaim,
} from "@/lib/db";
import { paidLedgerClaimedZipsFromDataFile } from "@/lib/territory";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import type { SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";

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

  async save(record: RevenueSubscriptionRecord): Promise<void> {
    saveRevenueSubscription(record);
  }

  async saveWithZipClaim(record: RevenueSubscriptionRecord, zip: string | null): Promise<ZipClaimOutcome> {
    return saveRevenueSubscriptionWithZipClaim(record, zip);
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
