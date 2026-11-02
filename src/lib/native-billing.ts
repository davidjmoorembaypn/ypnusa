import { readDb, saveRevenueSubscriptionWithZipClaim } from "@/lib/db";
import { PRICING_TIER_ORDER } from "@/lib/pricing";
import type { SessionPayload } from "@/lib/session";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { isValidZip } from "@/lib/territory";

/** No inferred grants from seed data, demo leads, or unverified migrated rows. */
export function nativeSubscriptionGrantsAccess(row: RevenueSubscriptionRecord, now = Date.now()): boolean {
  if (row.source !== "stripe_webhook" || row.stripeLivemode !== true || !row.stripeSubscriptionId) return false;
  if (row.status === "active") return row.paymentConfirmed === true;
  return row.status === "trialing" && !!row.trialEndsAt && Date.parse(row.trialEndsAt) > now;
}

export function refreshNativeEntitlement(session: SessionPayload): SessionPayload {
  const matches = readDb().revenueSubscriptions.filter((row) =>
    row.ownerEmail?.trim().toLowerCase() === session.email.trim().toLowerCase() && nativeSubscriptionGrantsAccess(row),
  ).sort((a, b) => PRICING_TIER_ORDER.indexOf(b.tier) - PRICING_TIER_ORDER.indexOf(a.tier));
  const subscription = matches[0];
  return { ...session, tier: subscription?.tier ?? "free", subscriptionStatus: subscription?.status === "active" ? "active" : subscription?.status === "trialing" ? "trialing" : "none", trialEndsAt: subscription?.trialEndsAt };
}

/** Re-run after either invoice or subscription events: Stripe can deliver them in either order. */
export function reconcilePaidZipClaims(): void {
  const db = readDb();
  for (const row of db.revenueSubscriptions) {
    if (row.source !== "stripe_webhook" || row.stripeLivemode !== true || row.status !== "active") continue;
    const paid = row.paymentConfirmed === true || db.paymentConversions.some((payment) => payment.stripeSubscriptionId === row.stripeSubscriptionId && payment.stripeCustomerId === row.stripeCustomerId);
    if (!paid) continue;
    const zip = row.requestedZip && isValidZip(row.requestedZip) ? row.requestedZip : null;
    if (row.paymentConfirmed && (!zip || row.claimedZips.includes(zip))) continue;
    saveRevenueSubscriptionWithZipClaim({ ...row, paymentConfirmed: true }, zip);
  }
}
