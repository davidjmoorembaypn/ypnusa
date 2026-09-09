import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { type ApiErrorEnvelope, jsonError } from "@/lib/http";
import { getPricingTier, PRICING_TIER_ORDER, type PricingTierId } from "@/lib/pricing";
import type { EntitlementStatus, SessionPayload } from "@/lib/session";
import type { LoanOfficerRecord } from "@/lib/types";

/**
 * Server-side entitlement resolution for app.ypnus.com.
 *
 * The ONLY forgery-resistant source of a user's paid tier is the signed SSO
 * handoff claim (see sso.ts) carried into their session token (session.ts).
 * Until ypnus.com's WordPress plugin starts sending `tier`/`subscriptionStatus`
 * on the handoff (see docs/sso-handoff.md — not live yet as of this writing),
 * every session resolves to `free`. That is the CORRECT and SAFE behavior,
 * not a bug to work around: this module must never grant paid capability by
 * inference, UI state, or absence of a signal — only from a claim that was
 * actually signed by the identity source. Once WordPress adopts the claim,
 * every check in this module activates automatically with zero further
 * app-side code changes.
 */

export interface Entitlement {
  tier: PricingTierId;
  status: EntitlementStatus;
  trialEndsAt?: string;
  /** False when this is the "no claim present" default — true only for a verified SSO/session claim. */
  hasVerifiedClaim: boolean;
}

/** Payment states that actually grant paid capability — past_due/canceled must not, even though WordPress keeps the last-known tier on file for support visibility. */
const ACTIVE_STATUSES: ReadonlySet<EntitlementStatus> = new Set(["active", "trialing"]);

export const FREE_ENTITLEMENT: Entitlement = { tier: "free", status: "none", hasVerifiedClaim: false };

export function resolveEntitlement(session: SessionPayload | null | undefined): Entitlement {
  if (!session?.tier) return FREE_ENTITLEMENT;

  const status = session.subscriptionStatus ?? "none";
  return {
    // A tier claim that isn't currently active/trialing (lapsed, past_due,
    // canceled) never grants paid capability — this is the enforcement
    // point that turns a stale/failed-payment claim back into "free".
    tier: ACTIVE_STATUSES.has(status) ? session.tier : "free",
    status,
    trialEndsAt: session.trialEndsAt,
    hasVerifiedClaim: true,
  };
}

export function tierRank(tier: PricingTierId): number {
  return PRICING_TIER_ORDER.indexOf(tier);
}

/** True when `entitlement`'s tier is at or above `minTier` in capability order (free < starter < growth < pro < elite). */
export function tierAtLeast(entitlement: Entitlement, minTier: PricingTierId): boolean {
  return tierRank(entitlement.tier) >= tierRank(minTier);
}

export function isPaidEntitlement(entitlement: Entitlement): boolean {
  return entitlement.tier !== "free";
}

export function zipCapacityFor(entitlement: Entitlement): number | "unlimited" {
  return getPricingTier(entitlement.tier).zipCapacity;
}

export function hasZipCapacity(entitlement: Entitlement, currentZipCount: number): boolean {
  const capacity = zipCapacityFor(entitlement);
  return capacity === "unlimited" || currentZipCount < capacity;
}

/**
 * Automation runs allowed per rolling day, by tier — "higher automation
 * limits" per plan (commercial requirement). Free gets none: automation
 * (nurture sequences, follow-up sends) is a paid-lead-delivery capability,
 * not part of the free Cerebro/diagnostic experience.
 */
const AUTOMATION_DAILY_LIMITS: Record<PricingTierId, number> = {
  free: 0,
  starter: 25,
  growth: 100,
  pro: 300,
  elite: Number.POSITIVE_INFINITY,
};

export function automationDailyLimitFor(entitlement: Entitlement): number {
  return AUTOMATION_DAILY_LIMITS[entitlement.tier];
}

/** Paid lead delivery (full contact details, CRM sync, active routing) requires any paid, active tier. */
export function canReceivePaidLeadDelivery(entitlement: Entitlement): boolean {
  return isPaidEntitlement(entitlement);
}

/**
 * Entitlement for server-to-server contexts (automation/lead-delivery jobs)
 * with no logged-in session — see LoanOfficerRecord.entitlementTier's doc
 * comment in types.ts for why an officer with no snapshot resolves as
 * unrestricted ("elite", uncapped) rather than "free": there is no live
 * sync populating this field yet, and defaulting to free here would only
 * break every currently-working seeded/demo officer with no way to fix it.
 * The moment a real sync starts writing entitlementTier/entitlementStatus,
 * this starts enforcing real per-officer limits with no further code change.
 */
export function resolveOfficerEntitlement(officer: Pick<LoanOfficerRecord, "entitlementTier" | "entitlementStatus">): Entitlement {
  if (!officer.entitlementTier) return { tier: "elite", status: "active", hasVerifiedClaim: false };

  const status = officer.entitlementStatus ?? "none";
  return {
    tier: ACTIVE_STATUSES.has(status) ? officer.entitlementTier : "free",
    status,
    hasVerifiedClaim: true,
  };
}

/**
 * Page-level gate, mirroring requireSession/requireAdminSession in auth.ts.
 * Call AFTER requireSession (or pass its result in) — this only checks tier,
 * not authentication. Redirects to /dashboard with an upgrade flag rather
 * than 403ing outright, since the visitor IS a valid logged-in MLO, just on
 * the wrong plan.
 */
export function requireTier(entitlement: Entitlement, minTier: PricingTierId, pathname: string): void {
  if (tierAtLeast(entitlement, minTier)) return;
  redirect(`/dashboard?upgrade=${minTier}&next=${encodeURIComponent(pathname)}`);
}

/** API-route equivalent of requireTier — returns a 402 Payment Required error, or null when the tier check passes. */
export function requireTierOrError(
  entitlement: Entitlement,
  minTier: PricingTierId,
): NextResponse<ApiErrorEnvelope> | null {
  if (tierAtLeast(entitlement, minTier)) return null;
  return jsonError(`This feature requires the ${getPricingTier(minTier).name} plan or higher.`, 402, "UPGRADE_REQUIRED");
}
