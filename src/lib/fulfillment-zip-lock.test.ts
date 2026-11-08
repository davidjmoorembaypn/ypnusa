import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-zip-lock-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("ZIP code locks only on the first real payment", async () => {
  const { applyFulfillmentEvent, lockZipOnPaidInvoice } = await import("./fulfillment");
  const { readDb, writeDb } = await import("./db");

  let clock = 1_800_000_000;
  function checkout(sub: string, customer: string, paymentStatus: "paid" | "no_payment_required", zip = "93720") {
    clock += 1;
    return applyFulfillmentEvent({
      stripeCustomerId: customer,
      stripeSubscriptionId: sub,
      zip,
      eventType: "checkout.session.completed",
      paymentStatus,
      tier: "growth",
      customerEmail: `${customer}@example.com`,
      eventCreatedAt: clock,
      eventId: `evt_${clock}`,
    });
  }
  const record = (sub: string) => readDb().revenueSubscriptions.find((s) => s.stripeSubscriptionId === sub)!;

  afterEach(() =>
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    }),
  );
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("a trial checkout leaves the ZIP code open and remembers it as pending", () => {
    const result = checkout("sub_trial", "cus_a", "no_payment_required");
    assert.equal(result.ok && result.applied && result.zipClaimed, false);
    assert.deepEqual(record("sub_trial").claimedZips, []);
    assert.equal(record("sub_trial").pendingZip, "93720");
    assert.equal(record("sub_trial").status, "trialing");
  });

  it("a $0 invoice does not lock; the first paid invoice does", () => {
    checkout("sub_trial", "cus_a", "no_payment_required");
    assert.equal(lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 0, invoiceStatus: "paid" }).applied, false);
    const lock = lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 9999, invoiceStatus: "paid" });
    assert.equal(lock.zipClaimed, true);
    assert.deepEqual(record("sub_trial").claimedZips, ["93720"]);
    assert.equal(record("sub_trial").pendingZip, undefined);
    assert.equal(record("sub_trial").status, "active");
    // Redelivery is a no-op.
    assert.equal(lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 9999, invoiceStatus: "paid" }).applied, false);
  });

  it("pay-now checkout locks immediately", () => {
    checkout("sub_now", "cus_b", "paid");
    assert.deepEqual(record("sub_now").claimedZips, ["93720"]);
    assert.equal(record("sub_now").status, "active");
  });

  it("whoever pays first gets the ZIP code; the trialist is flagged", () => {
    checkout("sub_trial", "cus_a", "no_payment_required");
    checkout("sub_now", "cus_b", "paid");
    const lock = lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 9999, invoiceStatus: "paid" });
    assert.equal(lock.zipConflict, true);
    assert.deepEqual(record("sub_trial").claimedZips, []);
    assert.equal(record("sub_trial").zipLockConflict?.zip, "93720");
    assert.deepEqual(record("sub_now").claimedZips, ["93720"]);
  });

  it("a 5-year prepaid purchase locks now, expires in 5 years, and a full refund releases it", async () => {
    const { mapStripeEventToFulfillmentPayload } = await import("./stripe-webhook");
    const { isLiveSubscription } = await import("./subscription-live");
    const created = 1_800_100_000;
    const checkoutEvent = {
      id: "evt_prepaid",
      created,
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "payment",
          customer: "cus_p",
          payment_intent: "pi_123",
          subscription: null,
          client_reference_id: "93612",
          payment_status: "paid",
          metadata: { ypnus_tier: "pro", ypnus_term: "5y", pricing: "2026-11" },
          customer_details: { email: "prepaid@example.com" },
        },
      },
    } as never;
    const payload = mapStripeEventToFulfillmentPayload(checkoutEvent)!;
    const applied = applyFulfillmentEvent(payload);
    assert.equal(applied.ok && applied.applied && applied.zipClaimed, true);
    const rec = record("prepaid_pi_123");
    assert.equal(rec.tier, "growth"); // public "Pro" = tier id growth
    assert.deepEqual(rec.claimedZips, ["93612"]);
    assert.equal(new Date(rec.expiresAt!).getUTCFullYear(), new Date(created * 1000).getUTCFullYear() + 5);
    assert.equal(isLiveSubscription(rec, created * 1000 + 1000), true);
    assert.equal(isLiveSubscription(rec, Date.parse(rec.expiresAt!) + 1), false);

    const refund = mapStripeEventToFulfillmentPayload({
      id: "evt_refund",
      created: created + 100,
      type: "charge.refunded",
      data: { object: { refunded: true, payment_intent: "pi_123", customer: "cus_p" } },
    } as never)!;
    applyFulfillmentEvent(refund);
    assert.equal(record("prepaid_pi_123").status, "cancelled");
  });
});
