import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type Stripe from "stripe";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-conversions-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function invoicePaid(overrides: {
  eventId: string;
  invoiceId: string;
  customer?: string;
  subscription?: string | null;
  amount?: number;
  livemode?: boolean;
  status?: string;
  created?: number;
}): Stripe.Event {
  const { eventId, invoiceId } = overrides;
  return {
    id: eventId,
    object: "event",
    type: "invoice.paid",
    livemode: overrides.livemode ?? true,
    created: overrides.created ?? 1_800_000_000,
    data: {
      object: {
        id: invoiceId,
        object: "invoice",
        customer: overrides.customer ?? "cus_real_1",
        status: overrides.status ?? "paid",
        amount_paid: overrides.amount ?? 9999,
        currency: "usd",
        billing_reason: "subscription_create",
        status_transitions: { paid_at: overrides.created ?? 1_800_000_000 },
        parent:
          overrides.subscription === null
            ? null
            : { subscription_details: { subscription: overrides.subscription ?? "sub_real_1" } },
      },
    },
  } as unknown as Stripe.Event;
}

describe("verified paid conversions", async () => {
  const { recordInvoicePaid, summarizeConversions } = await import("./conversions");
  const { saveRevenueSubscription } = await import("./db");

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const fulfill = (subscriptionId: string, customerId: string, status: "active" | "trialing" | "cancelled" = "active") =>
    saveRevenueSubscription({
      id: `rev_${subscriptionId}`,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      tier: "growth",
      status,
      source: "stripe_webhook",
      claimedZips: [],
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    });

  it("ignores test-mode, $0, unpaid and non-subscription invoices", () => {
    assert.equal(recordInvoicePaid(invoicePaid({ eventId: "e1", invoiceId: "in_1", livemode: false })).recorded, false);
    assert.equal(recordInvoicePaid(invoicePaid({ eventId: "e2", invoiceId: "in_2", amount: 0 })).recorded, false);
    assert.equal(recordInvoicePaid(invoicePaid({ eventId: "e3", invoiceId: "in_3", status: "open" })).recorded, false);
    assert.equal(recordInvoicePaid(invoicePaid({ eventId: "e4", invoiceId: "in_4", subscription: null })).recorded, false);
    assert.equal(summarizeConversions({}).paidCustomers, 0);
  });

  it("does not count a payment until the subscription is fulfilled in the app", () => {
    assert.equal(recordInvoicePaid(invoicePaid({ eventId: "e10", invoiceId: "in_10" })).recorded, true);
    const before = summarizeConversions({});
    assert.equal(before.paidCustomers, 1);
    assert.equal(before.qualifyingConversions, 0);
    assert.equal(before.paidButNotFulfilled.length, 1);

    fulfill("sub_real_1", "cus_real_1");
    const after1 = summarizeConversions({});
    assert.equal(after1.qualifyingConversions, 1);
    assert.equal(after1.qualifying[0].amountCents, 9999);
  });

  it("counts a redelivered webhook and a renewal for the same customer only once", () => {
    const dup = recordInvoicePaid(invoicePaid({ eventId: "e10", invoiceId: "in_10" }));
    assert.equal(dup.recorded, false);
    assert.match(dup.reason ?? "", /duplicate/i);

    recordInvoicePaid(invoicePaid({ eventId: "e11", invoiceId: "in_11", created: 1_802_600_000 }));
    assert.equal(summarizeConversions({}).qualifyingConversions, 1);
  });

  it("excludes existing customers and payments before the count-from date", () => {
    recordInvoicePaid(invoicePaid({ eventId: "e20", invoiceId: "in_20", customer: "cus_old", subscription: "sub_old", created: 1_700_000_000 }));
    fulfill("sub_old", "cus_old");
    assert.equal(summarizeConversions({}).qualifyingConversions, 2);
    assert.equal(summarizeConversions({ excludeCustomers: "cus_old" }).qualifyingConversions, 1);
    const fromDate = new Date(1_750_000_000 * 1000).toISOString();
    const summary = summarizeConversions({ countFrom: fromDate });
    assert.equal(summary.qualifyingConversions, 1);
    assert.equal(summary.excluded.beforeCountFrom, 1);
  });

  it("does not count a cancelled subscription as fulfilled", () => {
    recordInvoicePaid(invoicePaid({ eventId: "e30", invoiceId: "in_30", customer: "cus_c", subscription: "sub_c" }));
    fulfill("sub_c", "cus_c", "cancelled");
    assert.ok(summarizeConversions({ excludeCustomers: "cus_old" }).paidButNotFulfilled.length >= 1);
  });
});
