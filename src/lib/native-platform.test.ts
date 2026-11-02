import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-native-"));
process.env.LOANPILOT_DATA_DIR = directory;

describe("native migration boundaries", async () => {
  const { readDb, writeDb } = await import("./db");
  const { issueLoginChallenge, consumeLoginChallenge, revokeLoginChallenge } = await import("./native-auth");
  const { safeAccountNext } = await import("./native-platform");
  const { refreshNativeEntitlement } = await import("./native-billing");
  const { checkNativeTerritory } = await import("./native-territory");
  const { applyFulfillmentEvent } = await import("./fulfillment");
  const { GET } = await import("../app/api/territory/check/route");

  beforeEach(() => {
    process.env.YPNUS_NATIVE_PLATFORM = "true";
    delete process.env.YPNUS_NATIVE_LEDGER_READY;
    writeDb((db) => { db.nativeAccounts = []; db.loginChallenges = []; db.revenueSubscriptions = []; db.demoRequests = []; });
  });
  after(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it("requires email token AND requesting browser, consumes once, and stores only hashes", () => {
    const challenge = issueLoginChallenge("User@Example.com", "/onboarding");
    assert.ok(!JSON.stringify(readDb()).includes(challenge.token));
    assert.ok(!JSON.stringify(readDb()).includes(challenge.browser));
    assert.equal(consumeLoginChallenge(challenge.token, "x".repeat(43)), null);
    const result = consumeLoginChallenge(challenge.token, challenge.browser);
    assert.equal(result?.email, "user@example.com");
    assert.equal(result?.role, "mlo");
    assert.equal(result?.next, "/onboarding");
    assert.equal(consumeLoginChallenge(challenge.token, challenge.browser), null);
    const second = issueLoginChallenge("user@example.com", "/dashboard");
    assert.equal(consumeLoginChallenge(second.token, second.browser)?.sub, result?.sub);
  });

  it("rejects expired and revoked links, and throttles repeated email requests", () => {
    const expired = issueLoginChallenge("expired@example.com", "/dashboard");
    writeDb((db) => { db.loginChallenges![0].expiresAt = 0; });
    assert.equal(consumeLoginChallenge(expired.token, expired.browser), null);
    const revoked = issueLoginChallenge("revoked@example.com", "/dashboard");
    revokeLoginChallenge(revoked.token);
    assert.equal(consumeLoginChallenge(revoked.token, revoked.browser), null);
    for (let i = 0; i < 3; i++) issueLoginChallenge("limit@example.com", "/dashboard");
    assert.throws(() => issueLoginChallenge("limit@example.com", "/dashboard"));
  });

  it("rejects external, backslash, and admin redirect targets", () => {
    for (const next of ["//evil.example", "https://evil.example", "/\\evil.example", "/admin", "/dashboard/../admin", "/dashboard?next=//evil.example"]) {
      assert.equal(safeAccountNext(next), "/dashboard");
    }
  });

  it("fails closed until ZIP inventory is reconciled and never calls WordPress in native mode", async () => {
    assert.equal(checkNativeTerritory("93720"), null);
    const response = await GET(new Request("https://ypnus.com/api/territory/check?zip=93720"));
    assert.equal(response.status, 503);
    process.env.YPNUS_NATIVE_LEDGER_READY = "true";
    // These ZIPs are in the old hardcoded scarcity list; they must be free here.
    assert.equal(checkNativeTerritory("90210")?.available, true);
    assert.equal(checkNativeTerritory("937201")?.valid, false);
  });

  it("does not claim ZIPs or grant paid lead status on zero-dollar trial checkout", () => {
    const result = applyFulfillmentEvent({ stripeCustomerId: "cus_trial", stripeSubscriptionId: "sub_trial", eventType: "checkout.session.completed", paymentStatus: "no_payment_required", tier: "growth", zip: "93720", customerEmail: "user@example.com", eventCreatedAt: 100, livemode: true });
    assert.ok(result.ok && result.applied);
    assert.equal(readDb().revenueSubscriptions[0].status, "trialing");
    assert.deepEqual(readDb().revenueSubscriptions[0].claimedZips, []);
  });

  it("refreshes paid access from verified live billing and revokes it after failed payment", () => {
    const session = { sub: "native_test", email: "user@example.com", role: "mlo" as const, iat: 0, exp: 9999999999 };
    const base = { stripeCustomerId: "cus_paid", stripeSubscriptionId: "sub_paid", tier: "growth", customerEmail: session.email, livemode: true };
    applyFulfillmentEvent({ ...base, eventType: "checkout.session.completed", paymentStatus: "paid", zip: "93720", eventCreatedAt: 100 });
    assert.equal(refreshNativeEntitlement(session).tier, "growth");
    process.env.YPNUS_NATIVE_LEDGER_READY = "true";
    assert.equal(checkNativeTerritory("93720")?.available, false);
    applyFulfillmentEvent({ ...base, eventType: "customer.subscription.updated", subscriptionStatus: "past_due", eventCreatedAt: 101 });
    assert.equal(refreshNativeEntitlement(session).tier, "free");
    assert.equal(checkNativeTerritory("93720")?.available, true);
  });

  it("never grants access from test-mode payments", () => {
    applyFulfillmentEvent({ stripeCustomerId: "cus_test", stripeSubscriptionId: "sub_test", eventType: "checkout.session.completed", paymentStatus: "paid", tier: "elite", customerEmail: "user@example.com", eventCreatedAt: 100, livemode: false });
    assert.equal(refreshNativeEntitlement({ sub: "test", email: "user@example.com", role: "mlo", iat: 0, exp: 9999999999 }).tier, "free");
  });
});
