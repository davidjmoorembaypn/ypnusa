import { isLiveSubscription } from "@/lib/subscription-live";
import { PRICING_TIERS, type PricingTierId } from "@/lib/pricing";
import type { DbShape } from "@/lib/types";

/**
 * The owner's at-a-glance numbers for /admin. Read-only: it never changes the data file.
 *
 * It holds emails and company names of loan officers (the owner's own customers) but never a
 * borrower's details, a phone number, a Stripe id or a payment card detail.
 */
export interface AdminOverview {
  generatedAt: string;
  signups: { total: number; last7Days: number; last30Days: number };
  recentSignups: Array<{ email: string; createdAt: string; source: string; lastLoginAt: string | null }>;
  plans: { paying: number; trialing: number; mrrCents: number; byTier: Array<{ tier: string; count: number }> };
  zipLocks: Array<{ zip: string; tier: string; owner: string; since: string }>;
  payments: { last30DaysCents: number; last30DaysCount: number; recent: Array<{ paidAt: string; amountCents: number; currency: string; reason: string }> };
  textOptIns: { optIns: number; stopReplies: number; last30DaysOptIns: number };
  activity: { borrowerLeads: number; borrowerLeadsLast7Days: number; demoRequestsLast30Days: number };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function tierName(id: PricingTierId): string {
  return PRICING_TIERS.find((tier) => tier.id === id)?.name ?? id;
}

function since(iso: string | undefined, now: number, days: number): boolean {
  if (!iso) return false;
  const at = Date.parse(iso);
  return Number.isFinite(at) && now - at <= days * DAY_MS && at <= now;
}

function newestFirst<T>(items: T[], key: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => (Date.parse(key(b) ?? "") || 0) - (Date.parse(key(a) ?? "") || 0));
}

/** Monthly price of a live plan: the stored price, else the plan's list price. */
function monthlyCents(tier: PricingTierId, stored: number | undefined): number {
  if (typeof stored === "number" && stored >= 0) return stored;
  return PRICING_TIERS.find((candidate) => candidate.id === tier)?.priceMonthlyCents ?? 0;
}

export function summarizeAdminOverview(db: DbShape, now: number = Date.now()): AdminOverview {
  const accounts = db.accounts ?? [];
  const live = (db.revenueSubscriptions ?? []).filter((subscription) => isLiveSubscription(subscription, now));
  const paying = live.filter((subscription) => subscription.status === "active");
  const trialing = live.filter((subscription) => subscription.status === "trialing");

  const byTierMap = new Map<string, number>();
  for (const subscription of live) {
    const name = tierName(subscription.tier);
    byTierMap.set(name, (byTierMap.get(name) ?? 0) + 1);
  }

  // A ZIP code is locked only by a live plan that lists it in claimedZips (set at the first payment).
  const zipLocks = newestFirst(live, (subscription) => subscription.startedAt)
    .flatMap((subscription) =>
      subscription.claimedZips.map((zip) => ({
        zip,
        tier: tierName(subscription.tier),
        owner: subscription.company || subscription.ownerEmail || "Unnamed account",
        since: subscription.startedAt,
      })),
    )
    .sort((a, b) => a.zip.localeCompare(b.zip));

  const payments = db.paymentConversions ?? [];
  const recentPayments = payments.filter((payment) => since(payment.paidAt, now, 30));
  const optIns = db.smsOptIns ?? [];
  const leads = db.borrowerLeads ?? [];

  return {
    generatedAt: new Date(now).toISOString(),
    signups: {
      total: accounts.length,
      last7Days: accounts.filter((account) => since(account.createdAt, now, 7)).length,
      last30Days: accounts.filter((account) => since(account.createdAt, now, 30)).length,
    },
    recentSignups: newestFirst(accounts, (account) => account.createdAt)
      .slice(0, 10)
      .map((account) => ({
        email: account.email,
        createdAt: account.createdAt,
        source: account.source === "stripe_checkout" ? "Checkout" : "Sign-up",
        lastLoginAt: account.lastLoginAt ?? null,
      })),
    plans: {
      paying: paying.length,
      trialing: trialing.length,
      mrrCents: paying.reduce((sum, subscription) => sum + monthlyCents(subscription.tier, subscription.monthlyPriceCents), 0),
      byTier: [...byTierMap.entries()].map(([tier, count]) => ({ tier, count })).sort((a, b) => b.count - a.count),
    },
    zipLocks,
    payments: {
      last30DaysCents: recentPayments.reduce((sum, payment) => sum + payment.amountPaidCents, 0),
      last30DaysCount: recentPayments.length,
      recent: newestFirst(payments, (payment) => payment.paidAt)
        .slice(0, 10)
        .map((payment) => ({
          paidAt: payment.paidAt,
          amountCents: payment.amountPaidCents,
          currency: payment.currency,
          reason: payment.billingReason === "subscription_create" ? "First payment" : payment.billingReason === "subscription_cycle" ? "Renewal" : "Payment",
        })),
    },
    textOptIns: {
      optIns: optIns.filter((entry) => entry.granted).length,
      stopReplies: optIns.filter((entry) => !entry.granted).length,
      last30DaysOptIns: optIns.filter((entry) => entry.granted && since(entry.at, now, 30)).length,
    },
    activity: {
      borrowerLeads: leads.length,
      borrowerLeadsLast7Days: leads.filter((lead) => since(lead.createdAt, now, 7)).length,
      demoRequestsLast30Days: (db.demoRequests ?? []).filter((request) => since(request.createdAt, now, 30)).length,
    },
  };
}
