import { isValidZip, normalizeZip } from "@/lib/zip-format";
import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * Converts a subscription between the app's record and a `revenue_subscriptions` row, and
 * compares two records the way the parity check needs (a timestamp is equal when it is the same
 * instant, however it was written; a missing field equals an undefined one).
 */

/** Thrown for a record PostgreSQL cannot hold as written (for example an unreadable date). */
export class RecordNotStorableError extends Error {
  constructor(
    readonly recordId: string,
    reason: string,
  ) {
    super(`Subscription ${recordId} cannot be stored: ${reason}`);
    this.name = "RecordNotStorableError";
  }
}

/**
 * Thrown when a write was decided from a copy of the plan that is no longer current: another
 * event changed the plan (or created it) after this one read it. Nothing was written. The caller
 * reads the plan again and decides again.
 */
export class StaleWriteError extends Error {
  readonly code = "STALE_WRITE";
  constructor(
    readonly recordId: string,
    reason: string,
  ) {
    super(`Subscription ${recordId} changed while this write was being decided: ${reason}`);
    this.name = "StaleWriteError";
  }
}

export const SUBSCRIPTION_COLUMNS = [
  "id",
  "created_at",
  "started_at",
  "tier",
  "status",
  "source",
  "owner_lo_id",
  "owner_email",
  "company",
  "claimed_zips",
  "county_territories",
  "monthly_price_cents",
  "lifetime_months",
  "attributed_demo_request_ids",
  "stripe_customer_id",
  "stripe_subscription_id",
  "last_stripe_event_id",
  "last_stripe_event_created_at",
  "pending_zip",
  "expires_at",
  "stripe_payment_intent_id",
  "zip_lock_conflict_zip",
  "zip_lock_conflict_at",
  "addon",
] as const;

function timestamp(recordId: string, field: string, value: string | undefined, required: boolean): Date | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new RecordNotStorableError(recordId, `${field} is missing`);
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new RecordNotStorableError(recordId, `${field} is not a date`);
  return new Date(ms);
}

const orNull = <T>(value: T | undefined): T | null => (value === undefined ? null : value);

/** Parameter values for an insert, in SUBSCRIPTION_COLUMNS order. */
export function recordToRow(record: RevenueSubscriptionRecord): unknown[] {
  if (!record.id) throw new RecordNotStorableError("(no id)", "id is missing");
  return [
    record.id,
    timestamp(record.id, "createdAt", record.createdAt, true),
    timestamp(record.id, "startedAt", record.startedAt, true),
    record.tier,
    record.status,
    record.source,
    orNull(record.ownerLoId),
    orNull(record.ownerEmail),
    orNull(record.company),
    record.claimedZips ?? [],
    orNull(record.countyTerritories),
    orNull(record.monthlyPriceCents),
    orNull(record.lifetimeMonths),
    orNull(record.attributedDemoRequestIds),
    orNull(record.stripeCustomerId),
    orNull(record.stripeSubscriptionId),
    orNull(record.lastStripeEventId),
    orNull(record.lastStripeEventCreatedAt),
    orNull(record.pendingZip),
    timestamp(record.id, "expiresAt", record.expiresAt, false),
    orNull(record.stripePaymentIntentId),
    record.zipLockConflict ? record.zipLockConflict.zip : null,
    record.zipLockConflict ? timestamp(record.id, "zipLockConflict.at", record.zipLockConflict.at, true) : null,
    orNull(record.addon),
  ];
}

const iso = (value: unknown): string => (value instanceof Date ? value : new Date(String(value))).toISOString();

/** A `revenue_subscriptions` row back to the app's record. Columns that are null become absent fields. */
export function rowToRecord(row: Record<string, unknown>): RevenueSubscriptionRecord {
  const record: RevenueSubscriptionRecord = {
    id: String(row.id),
    createdAt: iso(row.created_at),
    startedAt: iso(row.started_at),
    tier: row.tier as RevenueSubscriptionRecord["tier"],
    status: row.status as RevenueSubscriptionRecord["status"],
    source: row.source as RevenueSubscriptionRecord["source"],
    claimedZips: (row.claimed_zips as string[] | null) ?? [],
  };
  if (row.owner_lo_id !== null) record.ownerLoId = String(row.owner_lo_id);
  if (row.owner_email !== null) record.ownerEmail = String(row.owner_email);
  if (row.company !== null) record.company = String(row.company);
  if (row.county_territories !== null) record.countyTerritories = row.county_territories as string[];
  if (row.monthly_price_cents !== null) record.monthlyPriceCents = Number(row.monthly_price_cents);
  if (row.lifetime_months !== null) record.lifetimeMonths = Number(row.lifetime_months);
  if (row.attributed_demo_request_ids !== null) record.attributedDemoRequestIds = row.attributed_demo_request_ids as string[];
  if (row.stripe_customer_id !== null) record.stripeCustomerId = String(row.stripe_customer_id);
  if (row.stripe_subscription_id !== null) record.stripeSubscriptionId = String(row.stripe_subscription_id);
  if (row.last_stripe_event_id !== null) record.lastStripeEventId = String(row.last_stripe_event_id);
  // bigint columns arrive as a string (node-postgres) or a number; Stripe's seconds always fit a number.
  if (row.last_stripe_event_created_at !== null) record.lastStripeEventCreatedAt = Number(row.last_stripe_event_created_at);
  if (row.pending_zip !== null) record.pendingZip = String(row.pending_zip);
  if (row.expires_at !== null) record.expiresAt = iso(row.expires_at);
  if (row.stripe_payment_intent_id !== null) record.stripePaymentIntentId = String(row.stripe_payment_intent_id);
  if (row.zip_lock_conflict_zip !== null && row.zip_lock_conflict_at !== null) {
    record.zipLockConflict = { zip: String(row.zip_lock_conflict_zip), at: iso(row.zip_lock_conflict_at) };
  }
  if (row.addon !== null) record.addon = row.addon as RevenueSubscriptionRecord["addon"];
  return record;
}

/** The record's ZIP code claims as the ledger stores them: valid 5-digit codes, each once. */
export function ledgerZips(record: Pick<RevenueSubscriptionRecord, "claimedZips">): string[] {
  const zips = new Set<string>();
  for (const raw of record.claimedZips ?? []) {
    const zip = normalizeZip(raw);
    if (isValidZip(zip)) zips.add(zip);
  }
  return [...zips].sort();
}

const instant = (value: string | undefined): number | string | undefined => {
  if (value === undefined) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : ms;
};

/** One comparable shape for a record: instants as numbers, empty and undefined fields dropped. */
function comparable(record: RevenueSubscriptionRecord): Record<string, unknown> {
  const shape: Record<string, unknown> = {
    id: record.id,
    createdAt: instant(record.createdAt),
    startedAt: instant(record.startedAt),
    tier: record.tier,
    status: record.status,
    source: record.source,
    ownerLoId: record.ownerLoId,
    ownerEmail: record.ownerEmail,
    company: record.company,
    claimedZips: record.claimedZips ?? [],
    countyTerritories: record.countyTerritories,
    monthlyPriceCents: record.monthlyPriceCents,
    lifetimeMonths: record.lifetimeMonths,
    attributedDemoRequestIds: record.attributedDemoRequestIds,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    lastStripeEventId: record.lastStripeEventId,
    lastStripeEventCreatedAt: record.lastStripeEventCreatedAt,
    pendingZip: record.pendingZip,
    expiresAt: instant(record.expiresAt),
    stripePaymentIntentId: record.stripePaymentIntentId,
    zipLockConflict: record.zipLockConflict
      ? { zip: record.zipLockConflict.zip, at: instant(record.zipLockConflict.at) }
      : undefined,
    addon: record.addon,
  };
  for (const key of Object.keys(shape)) {
    if (shape[key] === undefined || shape[key] === null) delete shape[key];
  }
  return shape;
}

/** Names of the fields on which two copies of a subscription differ. Empty when they match. */
export function differingFields(a: RevenueSubscriptionRecord, b: RevenueSubscriptionRecord): string[] {
  const left = comparable(a);
  const right = comparable(b);
  const fields = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...fields].filter((field) => JSON.stringify(left[field]) !== JSON.stringify(right[field])).sort();
}

export function sameSubscription(a: RevenueSubscriptionRecord, b: RevenueSubscriptionRecord): boolean {
  return differingFields(a, b).length === 0;
}
