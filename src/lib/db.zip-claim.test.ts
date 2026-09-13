import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-zip-claim-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function subscription(id: string): RevenueSubscriptionRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    tier: "starter",
    status: "active",
    source: "stripe_webhook",
    stripeSubscriptionId: `stripe_${id}`,
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
});
