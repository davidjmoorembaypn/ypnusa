import { normalizeEmail } from "@/lib/accounts";
import { MLO_MARKETS } from "@/content/mlo-markets";
import { readDb } from "@/lib/db";
import { onePlanAtATime, retryStaleWrites, subscriptionRepository } from "@/lib/repositories";
import { isLiveSubscription } from "@/lib/subscription-live";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { scheduleZipLockHook } from "@/lib/zip-scarcity";
import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * Can this loan officer still buy this ZIP code?
 *
 * Checkout runs on Stripe Payment Links, so nothing on our side can stop a payment once
 * the officer is on Stripe's page. The guard is therefore twofold:
 *   1. Before checkout: the upgrade panel asks here and never shows a payment button for
 *      a ZIP code another officer holds (it offers open ones nearby instead).
 *   2. At payment: if someone else locked it first anyway (two officers paying at once),
 *      the webhook flags the subscription with zipLockConflict, and the dashboard lets the
 *      officer lock an open ZIP code of their choice (claimReplacementZip).
 *
 * "Held" uses exactly the webhook's rule (saveRevenueSubscriptionWithZipClaim): a live
 * subscription whose claimedZips include the ZIP code. A trial's pendingZip holds nothing.
 */

const MAX_NEARBY = 4;

export interface ZipAvailability {
  zip: string;
  valid: boolean;
  /** No other officer holds it: checkout may proceed. */
  available: boolean;
  /** The viewer already holds it. */
  yours: boolean;
  /** Open ZIP codes close by (same market, or the same 3-digit area with real borrower requests). Only when taken. */
  nearby: string[];
}

function heldZips(now: number): Map<string, RevenueSubscriptionRecord> {
  const held = new Map<string, RevenueSubscriptionRecord>();
  for (const sub of readDb().revenueSubscriptions) {
    if (!isLiveSubscription(sub, now)) continue;
    for (const raw of sub.claimedZips) {
      const zip = normalizeZip(raw);
      if (isValidZip(zip) && !held.has(zip)) held.set(zip, sub);
    }
  }
  return held;
}

/**
 * Open ZIP codes near `zip`, from real places only (never made-up numbers): the other ZIP
 * codes of a market page that lists it, then ZIP codes in the same 3-digit postal area
 * where borrowers have actually asked for help, most requested first.
 */
export function nearbyOpenZips(rawZip: unknown, now: number = Date.now()): string[] {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return [];
  const held = heldZips(now);
  const picks: string[] = [];
  const add = (candidate: string) => {
    if (picks.length >= MAX_NEARBY || candidate === zip || picks.includes(candidate)) return;
    if (isValidZip(candidate) && !held.has(candidate)) picks.push(candidate);
  };

  for (const market of MLO_MARKETS) {
    if (market.zipCodes.includes(zip)) market.zipCodes.forEach(add);
  }

  const area = zip.slice(0, 3);
  const requests = new Map<string, number>();
  for (const lead of readDb().borrowerLeads) {
    const candidate = normalizeZip(lead.answers.zip);
    if (isValidZip(candidate) && candidate.startsWith(area)) requests.set(candidate, (requests.get(candidate) ?? 0) + 1);
  }
  [...requests.entries()]
    .sort((a, b) => b[1] - a[1] || Math.abs(Number(a[0]) - Number(zip)) - Math.abs(Number(b[0]) - Number(zip)))
    .forEach(([candidate]) => add(candidate));

  return picks;
}

export function checkZipForViewer(viewer: { email: string }, rawZip: unknown, now: number = Date.now()): ZipAvailability {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return { zip, valid: false, available: false, yours: false, nearby: [] };
  const holder = heldZips(now).get(zip);
  const email = normalizeEmail(viewer.email);
  const yours = Boolean(holder && email && normalizeEmail(holder.ownerEmail) === email);
  if (!holder || yours) return { zip, valid: true, available: !holder, yours, nearby: [] };
  return { zip, valid: true, available: false, yours: false, nearby: nearbyOpenZips(zip, now) };
}

/** A live paid plan of this officer whose ZIP code was taken by someone else before the payment landed. */
function isConflictedPlan(sub: RevenueSubscriptionRecord, email: string, now: number): boolean {
  return (
    normalizeEmail(sub.ownerEmail) === email &&
    isLiveSubscription(sub, now) &&
    sub.status === "active" &&
    sub.zipLockConflict !== undefined &&
    sub.claimedZips.length === 0
  );
}

/** A live paid plan of this officer that never had a ZIP code (and is not waiting to lock one). */
function isPlanWithoutZip(sub: RevenueSubscriptionRecord, email: string, now: number): boolean {
  return (
    normalizeEmail(sub.ownerEmail) === email &&
    isLiveSubscription(sub, now) &&
    sub.status === "active" &&
    (sub.source === "stripe_webhook" || sub.source === "admin_adjustment") &&
    sub.claimedZips.length === 0 &&
    !sub.pendingZip
  );
}

/** The viewer's paid plan whose ZIP code was taken by someone else before the payment landed. */
export function viewerZipConflict(viewer: { email: string }, now: number = Date.now()): RevenueSubscriptionRecord | null {
  const email = normalizeEmail(viewer.email);
  if (!email) return null;
  return readDb().revenueSubscriptions.find((sub) => isConflictedPlan(sub, email, now)) ?? null;
}

/**
 * The viewer's live paid plan that holds no ZIP code, so the dashboard can ask them to pick one.
 * Two ways to get there: another officer locked their ZIP code first (zipLockConflict is set), or
 * the checkout carried no ZIP code at all (the pricing buttons work before a ZIP code is checked).
 * Without this second case a paying officer had no territory, no lead routing, and no way to fix it.
 *
 * Trials are left out (their ZIP code locks at the first payment), and so is a plan still waiting
 * for its first invoice to lock a remembered ZIP code (pendingZip).
 */
export function viewerPlanNeedingZip(viewer: { email: string }, now: number = Date.now()): RevenueSubscriptionRecord | null {
  const conflicted = viewerZipConflict(viewer, now);
  if (conflicted) return conflicted;
  const email = normalizeEmail(viewer.email);
  if (!email) return null;
  return readDb().revenueSubscriptions.find((sub) => isPlanWithoutZip(sub, email, now)) ?? null;
}

export type ReplacementResult =
  | { ok: true; zip: string }
  | { ok: false; reason: "no_conflict" | "invalid_zip" | "taken"; nearby?: string[] };

/** Locks an open ZIP code for a paid plan that holds none: its first pick was taken, or it never had one. */
export async function claimReplacementZip(
  viewer: { email: string },
  rawZip: unknown,
  now: number = Date.now(),
): Promise<ReplacementResult> {
  const found = viewerPlanNeedingZip(viewer, now);
  if (!found) return { ok: false, reason: "no_conflict" };
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return { ok: false, reason: "invalid_zip" };
  const email = normalizeEmail(viewer.email) as string;
  const subscriptions = subscriptionRepository();
  return onePlanAtATime(found.stripeSubscriptionId, () =>
    retryStaleWrites(async (): Promise<ReplacementResult> => {
      // The plan was found in the data file's copy, which can be behind the store in charge
      // (PostgreSQL). Read it again from there and check it still needs a ZIP code: a plan
      // cancelled there must not be brought back to life by this write.
      const current = await subscriptions.findById(found.id);
      if (!current || !(isConflictedPlan(current, email, now) || isPlanWithoutZip(current, email, now))) {
        return { ok: false, reason: "no_conflict" };
      }
      // The claim itself re-checks inside one write, so two officers can't both get it.
      const { record, zipClaimed, zipConflict, zipNewlyLocked } = await subscriptions.saveWithZipClaim(current, zip, { expected: current });
      if (zipConflict || !zipClaimed) {
        // A conflicted claim saves the record as given, so the zipLockConflict flag stays on it.
        return { ok: false, reason: "taken", nearby: nearbyOpenZips(zip, now) };
      }
      await subscriptions.save({ ...record, zipLockConflict: undefined });
      if (zipNewlyLocked) scheduleZipLockHook(zip, current.id, "replacement");
      return { ok: true, zip };
    }),
  );
}
