import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-entitlements-ledger-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("resolveEntitlement reads the live subscription ledger", async () => {
  const { resolveEntitlement } = await import("./entitlements");
  const { claimedZipsForEmail } = await import("./accounts");
  const { writeDb } = await import("./db");

  const base = { sub: "acct_1", email: "lo@example.com", role: "mlo" as const, iat: 0, exp: 9_999_999_999 };

  function addSubscription(status: "trialing" | "active" | "cancelled", tier: "growth" | "pro" | "elite", zips: string[]) {
    writeDb((db) => {
      db.revenueSubscriptions.push({
        id: `sub_${db.revenueSubscriptions.length + 1}`,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        tier,
        status,
        source: "stripe_webhook",
        ownerEmail: "lo@example.com",
        claimedZips: zips,
      });
    });
  }

  afterEach(() => {
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("upgrades a session minted as free once the plan is bought", () => {
    addSubscription("trialing", "growth", ["93720"]);
    const result = resolveEntitlement({ ...base });
    assert.equal(result.tier, "growth");
    assert.equal(result.status, "trialing");
    assert.deepEqual(claimedZipsForEmail("LO@example.com"), ["93720"]);
  });

  it("drops a stale paid cookie to free once the subscription is cancelled", () => {
    addSubscription("cancelled", "pro", ["93612"]);
    const result = resolveEntitlement({ ...base, tier: "pro", subscriptionStatus: "active" });
    assert.equal(result.tier, "free");
    assert.deepEqual(claimedZipsForEmail("lo@example.com"), []);
  });

  it("falls back to the session claim when the ledger has no record for the email", () => {
    const result = resolveEntitlement({ ...base, tier: "pro", subscriptionStatus: "active" });
    assert.equal(result.tier, "pro");
  });
});
