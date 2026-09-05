import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-revenue-sub-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "store.json"), JSON.stringify({ demoRequests: [] }));

function subscription(
  id: string,
  overrides: Partial<RevenueSubscriptionRecord> = {},
): RevenueSubscriptionRecord {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    startedAt: now,
    tier: "pro",
    status: "active",
    source: "stripe_webhook",
    claimedZips: [],
    ...overrides,
  };
}

describe("revenue subscription persistence (db.ts)", async () => {
  const { readDb, findRevenueSubscriptionByStripeCustomerId, saveRevenueSubscription } =
    await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns null for a stripeCustomerId that was never saved", () => {
    assert.equal(findRevenueSubscriptionByStripeCustomerId("cus_never_saved"), null);
  });

  it("appends a brand-new subscription, findable by stripeCustomerId", () => {
    const record = subscription("sub_new_1", { stripeCustomerId: "cus_123" });
    saveRevenueSubscription(record);

    assert.deepEqual(findRevenueSubscriptionByStripeCustomerId("cus_123"), record);
  });

  it("upserts on a repeat save with the same id instead of duplicating", () => {
    const countBefore = readDb().revenueSubscriptions.length;

    const updated = subscription("sub_new_1", {
      stripeCustomerId: "cus_123",
      tier: "elite",
      status: "cancelled",
    });
    saveRevenueSubscription(updated);

    const db = readDb();
    assert.equal(db.revenueSubscriptions.length, countBefore);

    const stored = findRevenueSubscriptionByStripeCustomerId("cus_123");
    assert.equal(stored?.tier, "elite");
    assert.equal(stored?.status, "cancelled");
  });
});
