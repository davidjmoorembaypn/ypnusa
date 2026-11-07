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
});
