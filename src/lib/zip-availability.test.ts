import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-zip-availability-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("ZIP code availability before and at payment", async () => {
  const { applyFulfillmentEvent } = await import("./fulfillment");
  const { appendBorrowerLead, readDb, saveRevenueSubscription, writeDb } = await import("./db");
  const { checkZipForViewer, claimReplacementZip, nearbyOpenZips, viewerZipConflict } = await import("./zip-availability");
  const { generateId } = await import("./id");
  const { HOUSE_OFFICER_ID } = await import("./crm");

  let clock = 1_900_000_000;
  function payNow(sub: string, customer: string, zip: string) {
    clock += 1;
    return applyFulfillmentEvent({
      stripeCustomerId: customer,
      stripeSubscriptionId: sub,
      zip,
      eventType: "checkout.session.completed",
      paymentStatus: "paid",
      tier: "growth",
      customerEmail: `${customer}@example.com`,
      eventCreatedAt: clock,
      eventId: `evt_${clock}`,
    });
  }
  function request(zip: string) {
    appendBorrowerLead({
      id: generateId("lead"),
      createdAt: new Date().toISOString(),
      assignedLoId: HOUSE_OFFICER_ID,
      crmLeadId: "",
      qualification: {} as never,
      answers: { loanProgram: "FHA", zip },
    });
  }
  const record = (sub: string) => readDb().revenueSubscriptions.find((s) => s.stripeSubscriptionId === sub)!;

  afterEach(() =>
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
      db.borrowerLeads.length = 0;
    }),
  );
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("reports a ZIP code another officer holds as taken, with open ones nearby from real places only", () => {
    payNow("sub_owner", "cus_owner", "93291");
    payNow("sub_owner2", "cus_owner2", "93277");
    request("93274");
    request("93274");
    request("93257");
    request("94110"); // Different postal area: never offered.

    const result = checkZipForViewer({ email: "someone@example.com" }, "93291");
    assert.equal(result.available, false);
    assert.equal(result.yours, false);
    // Same market page first (93277 is held, so 93292), then most-requested in the 932xx area.
    assert.deepEqual(result.nearby, ["93292", "93274", "93257"]);
  });

  it("an open ZIP code is available, and the holder sees their own as yours", () => {
    payNow("sub_owner", "cus_owner", "93291");
    assert.deepEqual(checkZipForViewer({ email: "x@example.com" }, "93720"), {
      zip: "93720",
      valid: true,
      available: true,
      yours: false,
      nearby: [],
    });
    const own = checkZipForViewer({ email: "cus_owner@example.com" }, "93291");
    assert.equal(own.yours, true);
    assert.equal(own.available, false);
    assert.equal(checkZipForViewer({ email: "x@example.com" }, "12").valid, false);
  });

  it("a trial's pending ZIP code is not held", () => {
    clock += 1;
    applyFulfillmentEvent({
      stripeCustomerId: "cus_trial",
      stripeSubscriptionId: "sub_trial",
      zip: "93611",
      eventType: "checkout.session.completed",
      paymentStatus: "no_payment_required",
      tier: "growth",
      customerEmail: "cus_trial@example.com",
      eventCreatedAt: clock,
      eventId: `evt_${clock}`,
    });
    assert.equal(checkZipForViewer({ email: "x@example.com" }, "93611").available, true);
  });

  it("a payment for a ZIP code someone locked first is flagged, then the officer locks an open one", () => {
    payNow("sub_first", "cus_first", "93291");
    const second = payNow("sub_second", "cus_second", "93291");
    assert.equal(second.ok && second.applied && second.zipConflict, true);
    assert.deepEqual(record("sub_second").claimedZips, []);
    assert.equal(record("sub_second").zipLockConflict?.zip, "93291");
    assert.deepEqual(record("sub_first").claimedZips, ["93291"]);

    const viewer = { email: "cus_second@example.com" };
    assert.equal(viewerZipConflict(viewer)?.stripeSubscriptionId, "sub_second");

    // Still taken: refused, flag kept, open ones offered.
    const retry = claimReplacementZip(viewer, "93291");
    assert.equal(retry.ok, false);
    assert.equal(!retry.ok && retry.reason, "taken");
    assert.equal(record("sub_second").zipLockConflict?.zip, "93291");

    const fixed = claimReplacementZip(viewer, "93292");
    assert.deepEqual(fixed, { ok: true, zip: "93292" });
    assert.deepEqual(record("sub_second").claimedZips, ["93292"]);
    assert.equal(record("sub_second").zipLockConflict, undefined);
    assert.equal(viewerZipConflict(viewer), null);
    assert.deepEqual(claimReplacementZip(viewer, "93720"), { ok: false, reason: "no_conflict" });
  });

  it("an officer without a conflicted plan can't use the replacement path to grab a second ZIP code", () => {
    payNow("sub_owner", "cus_owner", "93291");
    assert.deepEqual(claimReplacementZip({ email: "cus_owner@example.com" }, "93720"), { ok: false, reason: "no_conflict" });
    saveRevenueSubscription({
      id: generateId("sub"),
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      tier: "growth",
      status: "cancelled",
      source: "stripe_webhook",
      ownerEmail: "gone@example.com",
      claimedZips: [],
      zipLockConflict: { zip: "93291", at: new Date().toISOString() },
    });
    assert.deepEqual(claimReplacementZip({ email: "gone@example.com" }, "93720"), { ok: false, reason: "no_conflict" });
  });

  it("nearbyOpenZips ignores invalid input", () => {
    assert.deepEqual(nearbyOpenZips("abc"), []);
  });
});
