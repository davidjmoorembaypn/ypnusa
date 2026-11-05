import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { applyWordPressImport, planWordPressImport } from "./wordpress-import";
import { entitlementForEmail, findAccountByEmail } from "./accounts";
import { checkPaidLedgerTerritory } from "./territory";

process.env.LOANPILOT_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-wp-import-"));

const EXPORT = {
  users: [
    { wpUserId: "1", email: "Paid@Example.com", tier: "growth", subscriptionStatus: "active", stripeSubscriptionId: "sub_a" },
    { wpUserId: "2", email: "trial@example.com", tier: "elite", subscriptionStatus: "trialing", stripeSubscriptionId: "sub_b" },
    { wpUserId: "3", email: "lapsed@example.com", tier: "pro", subscriptionStatus: "past_due" },
    { wpUserId: "4", email: "free@example.com" },
    { wpUserId: "5", email: "" },
  ],
  zipLocks: [
    { zip: "93291", wpUserId: "1", stripeSubscriptionId: "sub_a", tier: "growth" },
    { zip: "93277", wpUserId: "2", stripeSubscriptionId: "sub_b", tier: "elite" },
    { zip: "93292", wpUserId: "3", tier: "pro" },
  ],
};

describe("WordPress import", () => {
  it("plans accounts for every valid email and plans only for active or trialing users", () => {
    const plan = planWordPressImport(EXPORT);
    assert.equal(plan.accounts.length, 4);
    assert.deepEqual(
      plan.subscriptions.map((s) => [s.ownerEmail, s.tier, s.status, s.claimedZips]),
      [
        ["paid@example.com", "pro", "active", ["93291"]],
        ["trial@example.com", "exclusive", "trialing", ["93277"]],
      ],
    );
    assert.ok(plan.warnings.some((w) => w.includes("lapsed@example.com")));
    assert.ok(plan.warnings.some((w) => w.includes("WordPress user 5")));
  });

  it("applies idempotently and makes the app the source of truth for sign-in, plans and ZIPs", () => {
    applyWordPressImport(planWordPressImport(EXPORT));
    applyWordPressImport(planWordPressImport(EXPORT));

    assert.equal(findAccountByEmail("paid@example.com")?.wpUserId, "1");
    assert.deepEqual(entitlementForEmail("paid@example.com"), { tier: "pro", subscriptionStatus: "active" });
    assert.deepEqual(entitlementForEmail("trial@example.com"), { tier: "exclusive", subscriptionStatus: "trialing" });
    assert.deepEqual(entitlementForEmail("free@example.com"), { tier: "free", subscriptionStatus: "none" });

    assert.equal(checkPaidLedgerTerritory("93291").available, false);
    assert.equal(checkPaidLedgerTerritory("93277").available, false);
    assert.equal(checkPaidLedgerTerritory("93292").available, true);
  });
});
