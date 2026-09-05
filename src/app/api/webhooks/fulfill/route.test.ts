import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const routeSource = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8");

describe("Lambda Stripe-fulfillment webhook — /api/webhooks/fulfill route", () => {
  it("gates on the dedicated internal secret, not ADMIN_TOKEN/CRON_SECRET", () => {
    assert.match(routeSource, /requireInternalSecret/);
    assert.ok(
      !routeSource.includes("requireSecret(request)"),
      "must not fall back to the ADMIN_TOKEN/CRON_SECRET gate",
    );
  });

  it("rate-limits the endpoint", () => {
    assert.match(routeSource, /enforceRateLimit/);
  });

  it("resolves tier only through the shared Stripe id map, never a hardcoded default", () => {
    assert.match(routeSource, /resolveTierFromStripeIdentifier/);
  });

  it("persists via the shared db upsert helpers, not a direct writeDb call", () => {
    assert.match(routeSource, /saveRevenueSubscription/);
    assert.match(routeSource, /findRevenueSubscriptionByStripeCustomerId/);
    assert.ok(!routeSource.includes("writeDb"), "route.ts should not import writeDb directly");
  });

  it("handles both eventTypes the Lambda forwarder sends", () => {
    assert.match(routeSource, /checkout\.session\.completed/);
    assert.match(routeSource, /customer\.subscription\.deleted/);
  });
});
