import { readDb, writeDb } from "./db";
import type { DemoRequestRecord, RevenueSubscriptionRecord } from "./types";

/**
 * Exclusive ZIP-code territory logic.
 *
 * A territory is a 5-digit ZIP that a single loan officer owns exclusively —
 * every borrower lead generated in that ZIP routes only to them. Availability is
 * computed only from real claims:
 *   1. Live paid subscriptions (active or trialing) that hold the ZIP.
 *   2. Reservations captured through the marketing site (demo requests that
 *      named a ZIP).
 *
 * There is deliberately no seeded list of "taken" ZIPs: showing a ZIP as owned when
 * nobody owns it is false scarcity. Seeded demo subscriptions (source "seed") never
 * count either.
 *
 * This intentionally does not depend on an external ZIP database: it validates
 * format and answers "is this territory still open?" — which is the question a
 * prospective subscriber actually asks.
 */

export interface TerritoryCheckResult {
  ok: boolean;
  zip: string;
  valid: boolean;
  available: boolean;
  /** Total territories claimed nationwide (seed + live) — powers scarcity copy. */
  totalClaimed: number;
  message: string;
}

export function normalizeZip(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

function liveClaimedZips(): Set<string> {
  const db = readDb();
  return mergeClaimedZips(db.demoRequests, db.revenueSubscriptions);
}

/**
 * ZIP scarcity must reflect paid, durable claims (active revenue subscriptions; a free trial holds no ZIP)
 * as well as the softer demo-request signal — otherwise a ZIP someone already paid for
 * would still show "available" to the next visitor. Stripe billing/entitlement is owned
 * by ypnus.com's ypnus-stripe-webhook plugin, not this local store — see docs/sso-handoff.md.
 */
function mergeClaimedZips(
  demoRequests: DemoRequestRecord[],
  revenueSubscriptions: RevenueSubscriptionRecord[],
): Set<string> {
  const claimed = new Set<string>();
  demoRequests.forEach((request) => {
    const zip = normalizeZip(request.zip);
    if (isValidZip(zip)) claimed.add(zip);
  });
  revenueSubscriptions
    .filter(
      (subscription) =>
        // Seeded demo subscriptions are not real claims.
        subscription.source !== "seed" && subscription.status === "active",
    )
    .forEach((subscription) => {
      subscription.claimedZips.forEach((rawZip) => {
        const zip = normalizeZip(rawZip);
        if (isValidZip(zip)) claimed.add(zip);
      });
    });
  return claimed;
}

export function totalClaimedTerritories(): number {
  const merged = liveClaimedZips();
  return merged.size;
}

/** Build a territory result from an already-computed set of live claims. */
function buildResult(zip: string, claimedZips: Set<string>): TerritoryCheckResult {
  const totalClaimed = claimedZips.size;

  if (!isValidZip(zip)) {
    return {
      ok: true,
      zip,
      valid: false,
      available: false,
      totalClaimed,
      message: "Enter a valid 5-digit ZIP code to check territory availability.",
    };
  }

  const claimed = claimedZips.has(zip);
  return {
    ok: true,
    zip,
    valid: true,
    available: !claimed,
    totalClaimed,
    message: claimed
      ? `Territory ${zip} is already owned. Join the waitlist and we'll alert you the moment it reopens.`
      : `Territory ${zip} is available — reserve it before another officer does.`,
  };
}

/**
 * Availability from this app's own paid ledger only: ZIPs held by active or trialing subscriptions that
 * came from Stripe, an admin adjustment or the WordPress import. Demo seeds and soft
 * demo-request holds are ignored. Used when TERRITORY_SOURCE=local, i.e. once WordPress is
 * retired and this app is the system of record for territories.
 */
export function checkPaidLedgerTerritory(rawZip: unknown): TerritoryCheckResult {
  const zip = normalizeZip(rawZip);
  const claimed = new Set<string>();
  readDb()
    .revenueSubscriptions.filter(
      (subscription) =>
        // Trialing counts: the ZIP is locked at checkout, the same as WordPress did.
        (subscription.status === "active" || subscription.status === "trialing") &&
        (subscription.source === "stripe_webhook" || subscription.source === "admin_adjustment"),
    )
    .forEach((subscription) =>
      subscription.claimedZips.forEach((rawClaim) => {
        const claim = normalizeZip(rawClaim);
        if (isValidZip(claim)) claimed.add(claim);
      }),
    );

  if (!isValidZip(zip)) {
    return {
      ok: true,
      zip,
      valid: false,
      available: false,
      totalClaimed: claimed.size,
      message: "Enter a valid 5-digit ZIP code to check territory availability.",
    };
  }
  const taken = claimed.has(zip);
  return {
    ok: true,
    zip,
    valid: true,
    available: !taken,
    totalClaimed: claimed.size,
    message: taken
      ? `Territory ${zip} is already owned. Join the waitlist and we'll alert you the moment it reopens.`
      : `Territory ${zip} is available. Reserve it before another officer does.`,
  };
}

export function checkTerritory(rawZip: unknown): TerritoryCheckResult {
  // Read the live claim set once (readDb deep-clones the store, so avoid doing it twice).
  return buildResult(normalizeZip(rawZip), liveClaimedZips());
}

/**
 * Persist a demo request and compute territory availability in one writeDb.
 *
 * Availability is read from the live store inside the mutator, immediately
 * before the push, so a second overlapping claim for the same ZIP sees the
 * first reservation and returns waitlist copy instead of a duplicate activation.
 */
export function appendDemoRequestWithTerritoryCheck(
  record: DemoRequestRecord,
): TerritoryCheckResult | null {
  const zip = normalizeZip(record.zip);
  if (!zip) {
    writeDb((db) => {
      db.demoRequests.push(record);
    });
    return null;
  }

  let territory: TerritoryCheckResult | null = null;

  writeDb((db) => {
    territory = buildResult(zip, mergeClaimedZips(db.demoRequests, db.revenueSubscriptions));
    db.demoRequests.push(record);
  });

  return territory;
}
