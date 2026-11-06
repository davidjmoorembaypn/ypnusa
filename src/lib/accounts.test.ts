import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { entitlementForEmail, findAccountByEmail, normalizeEmail, upsertAccount } from "./accounts";
import { saveRevenueSubscription } from "./db";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-accounts-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
process.env.ADMIN_EMAILS = "owner@ypnus.com";


describe("accounts", () => {
  it("normalizes and validates emails", () => {
    assert.equal(normalizeEmail("  A.B@Example.COM "), "a.b@example.com");
    assert.equal(normalizeEmail("nope"), null);
    assert.equal(normalizeEmail("a b@example.com"), null);
  });

  it("creates once, then updates the same account", () => {
    const first = upsertAccount({ email: "New@Example.com", source: "email_signup", markLogin: true });
    const second = upsertAccount({ email: "new@example.com", source: "stripe_checkout", wpUserId: "42" });
    assert.equal(first.id, second.id);
    assert.equal(second.source, "email_signup");
    assert.equal(second.wpUserId, "42");
    assert.equal(findAccountByEmail("NEW@example.com")?.id, first.id);
    assert.equal(first.role, "mlo");
  });

  it("gives ADMIN_EMAILS the admin role", () => {
    assert.equal(upsertAccount({ email: "owner@ypnus.com", source: "email_signup" }).role, "admin");
  });

  it("reads the best live paid plan from Stripe-fed subscriptions, ignoring demo seeds", () => {
    assert.deepEqual(entitlementForEmail("buyer@example.com"), { tier: "free", subscriptionStatus: "none" });
    const base = {
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      ownerEmail: "Buyer@Example.com",
      claimedZips: [],
    };
    saveRevenueSubscription({ ...base, id: "s1", tier: "pro", status: "active", source: "stripe_webhook" });
    saveRevenueSubscription({ ...base, id: "s2", tier: "elite", status: "trialing", source: "stripe_webhook" });
    saveRevenueSubscription({ ...base, id: "s3", tier: "elite", status: "cancelled", source: "stripe_webhook" });
    assert.deepEqual(entitlementForEmail("buyer@example.com"), { tier: "elite", subscriptionStatus: "trialing" });

    saveRevenueSubscription({ ...base, id: "s4", ownerEmail: "seed@example.com", tier: "elite", status: "active", source: "seed" });
    assert.deepEqual(entitlementForEmail("seed@example.com"), { tier: "free", subscriptionStatus: "none" });
  });
});
