import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-zip-claim-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function subscription(id: string, stripeCustomerId = `cus_${id}`): RevenueSubscriptionRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    tier: "starter",
    status: "active",
    source: "stripe_webhook",
    stripeSubscriptionId: `stripe_${id}`,
    stripeCustomerId,
    claimedZips: [],
  };
}

describe("saveRevenueSubscriptionWithZipClaim", async () => {
  const { readDb, writeDb, saveRevenueSubscriptionWithZipClaim } = await import("./db");

  before(() => {
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("locks the zip onto a new subscription", () => {
    const result = saveRevenueSubscriptionWithZipClaim(subscription("sub_a"), "90210");
    assert.equal(result.zipClaimed, true);
    assert.equal(result.zipConflict, false);
    assert.deepEqual(result.record.claimedZips, ["90210"]);

    const stored = readDb().revenueSubscriptions.find((s) => s.id === "sub_a");
    assert.deepEqual(stored?.claimedZips, ["90210"]);
  });

  it("refuses to double-claim a zip already held by another active subscription", () => {
    const result = saveRevenueSubscriptionWithZipClaim(subscription("sub_b"), "90210");
    assert.equal(result.zipClaimed, false);
    assert.equal(result.zipConflict, true);
    assert.deepEqual(result.record.claimedZips, []);
  });

  it("is idempotent when the same subscription re-claims its own zip", () => {
    const existing = readDb().revenueSubscriptions.find((s) => s.id === "sub_a")!;
    const result = saveRevenueSubscriptionWithZipClaim(existing, "90210");
    assert.equal(result.zipClaimed, false);
    assert.equal(result.zipConflict, false);
    assert.deepEqual(result.record.claimedZips, ["90210"]);
  });

  it("leaves claimedZips untouched when zip is null", () => {
    const result = saveRevenueSubscriptionWithZipClaim(subscription("sub_c"), null);
    assert.equal(result.zipClaimed, false);
    assert.equal(result.zipConflict, false);
    assert.deepEqual(result.record.claimedZips, []);
  });

  it("treats a replacement subscription for the same customer as a transfer, not a conflict", () => {
    // sub_a (customer cus_sub_a) already holds 90210 from the earlier tests. A
    // replacement subscription for that *same* Stripe customer — created before
    // Stripe's delete event for the old one arrives — must be able to claim the
    // same zip without being told it conflicts with itself.
    const replacement = subscription("sub_a_replacement", "cus_sub_a");
    const result = saveRevenueSubscriptionWithZipClaim(replacement, "90210");
    assert.equal(result.zipConflict, false);
    assert.equal(result.zipClaimed, true);
    assert.deepEqual(result.record.claimedZips, ["90210"]);
  });

  it("still reports a conflict for a genuinely different customer", () => {
    const result = saveRevenueSubscriptionWithZipClaim(subscription("sub_d", "cus_sub_d"), "90210");
    assert.equal(result.zipConflict, true);
    assert.equal(result.zipClaimed, false);
    assert.deepEqual(result.record.claimedZips, []);
  });

  it("strips a stale contested zip from the record's own claimedZips on conflict", () => {
    // sub_e already stale-holds 77001 in its own claimedZips (e.g. from before it
    // was cancelled and reactivated). Meanwhile a genuinely different customer,
    // sub_f, now legitimately holds 77001. Re-saving sub_e with that same zip
    // must not leave two active subscriptions both listing it.
    const staleHolder: RevenueSubscriptionRecord = {
      ...subscription("sub_e", "cus_sub_e"),
      claimedZips: ["77001"],
    };
    saveRevenueSubscriptionWithZipClaim(subscription("sub_f", "cus_sub_f"), "77001");

    const result = saveRevenueSubscriptionWithZipClaim(staleHolder, "77001");
    assert.equal(result.zipConflict, true);
    assert.equal(result.zipClaimed, false);
    assert.deepEqual(result.record.claimedZips, []);

    const stored = readDb().revenueSubscriptions.find((s) => s.id === "sub_e");
    assert.deepEqual(stored?.claimedZips, []);
  });
});

describe("zipNewlyLocked: a true open -> claimed transition", async () => {
  const { writeDb, saveRevenueSubscriptionWithZipClaim } = await import("./db");

  before(() => {
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });

  it("is true for a fresh lock on a ZIP code nobody held", () => {
    const result = saveRevenueSubscriptionWithZipClaim(subscription("fresh_a", "cus_one"), "93618");
    assert.equal(result.zipClaimed, true);
    assert.equal(result.zipNewlyLocked, true);
  });

  it("is false when the same subscription re-claims its own ZIP code (redelivered webhook)", () => {
    const again = saveRevenueSubscriptionWithZipClaim({ ...subscription("fresh_a", "cus_one"), claimedZips: ["93618"] }, "93618");
    assert.equal(again.zipClaimed, false);
    assert.equal(again.zipNewlyLocked, false);
    // Even if the caller passes a stale record without the ZIP code, the stored copy already holds it.
    const stale = saveRevenueSubscriptionWithZipClaim(subscription("fresh_a", "cus_one"), "93618");
    assert.equal(stale.zipClaimed, true);
    assert.equal(stale.zipNewlyLocked, false);
  });

  it("is false for a same-customer transfer: the replacement gets the ZIP code, but it was already taken", () => {
    const replacement = saveRevenueSubscriptionWithZipClaim(subscription("fresh_a_replacement", "cus_one"), "93618");
    assert.equal(replacement.zipConflict, false);
    assert.equal(replacement.zipClaimed, true);
    assert.equal(replacement.zipNewlyLocked, false);
  });

  it("is false on a conflict with another customer, and when no ZIP code is claimed", () => {
    const conflict = saveRevenueSubscriptionWithZipClaim(subscription("other", "cus_two"), "93618");
    assert.equal(conflict.zipConflict, true);
    assert.equal(conflict.zipNewlyLocked, false);
    assert.equal(saveRevenueSubscriptionWithZipClaim(subscription("no_zip", "cus_three"), null).zipNewlyLocked, false);
  });

  it("is true again once every earlier holder has cancelled and someone new locks it", () => {
    writeDb((db) => {
      for (const s of db.revenueSubscriptions) if (s.claimedZips.includes("93618")) s.status = "cancelled";
    });
    const reopened = saveRevenueSubscriptionWithZipClaim(subscription("later", "cus_four"), "93618");
    assert.equal(reopened.zipClaimed, true);
    assert.equal(reopened.zipNewlyLocked, true);
  });
});
