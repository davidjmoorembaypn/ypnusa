import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeAdminOverview } from "./admin-overview";
import type { DbShape, RevenueSubscriptionRecord } from "./types";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function sub(partial: Partial<RevenueSubscriptionRecord>): RevenueSubscriptionRecord {
  return {
    id: partial.id ?? "sub",
    createdAt: daysAgo(10),
    startedAt: daysAgo(10),
    tier: "pro",
    status: "active",
    source: "stripe_webhook",
    claimedZips: [],
    ...partial,
  };
}

function db(partial: Partial<DbShape>): DbShape {
  return {
    accounts: [],
    revenueSubscriptions: [],
    paymentConversions: [],
    smsOptIns: [],
    borrowerLeads: [],
    demoRequests: [],
    ...partial,
  } as unknown as DbShape;
}

describe("summarizeAdminOverview", () => {
  it("counts paying plans, trials, monthly revenue and only live ZIP code locks", () => {
    const overview = summarizeAdminOverview(
      db({
        revenueSubscriptions: [
          sub({ id: "a", tier: "pro", status: "active", claimedZips: ["93618"], company: "Acme Lending", monthlyPriceCents: 9900 }),
          sub({ id: "b", tier: "growth", status: "active", claimedZips: ["93720", "93711"], ownerEmail: "lo@example.com" }),
          sub({ id: "c", tier: "pro", status: "trialing", claimedZips: [] }),
          sub({ id: "d", tier: "elite", status: "cancelled", claimedZips: ["90210"] }),
          sub({ id: "e", tier: "pro", status: "active", claimedZips: ["10001"], expiresAt: daysAgo(1) }),
        ],
      }),
      NOW,
    );
    assert.equal(overview.plans.paying, 2);
    assert.equal(overview.plans.trialing, 1);
    assert.ok(overview.plans.mrrCents >= 9900);
    assert.deepEqual(overview.zipLocks.map((lock) => lock.zip), ["93618", "93711", "93720"]);
    assert.equal(overview.zipLocks[0].owner, "Acme Lending");
    assert.equal(overview.zipLocks[1].owner, "lo@example.com");
  });

  it("counts sign-ups, payments and text opt-ins by window, newest first", () => {
    const overview = summarizeAdminOverview(
      db({
        accounts: [
          { id: "1", email: "old@example.com", role: "mlo", createdAt: daysAgo(40), source: "email_signup" },
          { id: "2", email: "new@example.com", role: "mlo", createdAt: daysAgo(2), source: "stripe_checkout" },
        ],
        paymentConversions: [
          { id: "p1", eventId: "e1", recordedAt: daysAgo(3), paidAt: daysAgo(3), stripeCustomerId: "cus", stripeSubscriptionId: "s", amountPaidCents: 9900, currency: "usd", billingReason: "subscription_create" },
          { id: "p2", eventId: "e2", recordedAt: daysAgo(60), paidAt: daysAgo(60), stripeCustomerId: "cus", stripeSubscriptionId: "s", amountPaidCents: 19900, currency: "usd" },
        ],
        smsOptIns: [
          { id: "o1", phone: "enc", granted: true, source: "lo_sms_opt_in_page", at: daysAgo(1) },
          { id: "o2", phone: "enc", granted: false, source: "sms_stop", at: daysAgo(1) },
        ],
      }),
      NOW,
    );
    assert.deepEqual(overview.signups, { total: 2, last7Days: 1, last30Days: 1 });
    assert.equal(overview.recentSignups[0].email, "new@example.com");
    assert.equal(overview.recentSignups[0].source, "Checkout");
    assert.equal(overview.payments.last30DaysCents, 9900);
    assert.equal(overview.payments.recent[0].reason, "First payment");
    assert.deepEqual(overview.textOptIns, { optIns: 1, stopReplies: 1, last30DaysOptIns: 1 });
  });

  it("never carries a phone number or a Stripe id", () => {
    const overview = summarizeAdminOverview(
      db({
        paymentConversions: [
          { id: "p1", eventId: "e1", recordedAt: daysAgo(3), paidAt: daysAgo(3), stripeCustomerId: "cus_secret", stripeSubscriptionId: "sub_secret", amountPaidCents: 9900, currency: "usd" },
        ],
        smsOptIns: [{ id: "o1", phone: "5595550100", granted: true, source: "lo_sms_opt_in_page", at: daysAgo(1) }],
      }),
      NOW,
    );
    const text = JSON.stringify(overview);
    assert.ok(!text.includes("cus_secret") && !text.includes("sub_secret") && !text.includes("5595550100"));
  });

  it("works on an empty store", () => {
    const overview = summarizeAdminOverview(db({}), NOW);
    assert.equal(overview.plans.paying, 0);
    assert.equal(overview.zipLocks.length, 0);
  });
});
