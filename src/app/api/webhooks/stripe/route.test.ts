import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import Stripe from "stripe";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-stripe-webhook-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "store.json"), JSON.stringify({ demoRequests: [] }));

const WEBHOOK_SECRET = "whsec_test_secret";
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_PRICE_ID_PRO = "price_pro_test";

function signedRequest(event: Record<string, unknown>): Request {
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("https://app.ypnus.com/api/webhooks/stripe", {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": header },
    body: payload,
  });
}

function checkoutSessionEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_checkout_1",
    object: "event",
    type: "checkout.session.completed",
    created: 1_000,
    data: {
      object: {
        object: "checkout.session",
        customer: "cus_1",
        subscription: "sub_1",
        client_reference_id: "93720",
        payment_status: "paid",
        metadata: { ypnus_tier: "growth" },
        ...overrides,
      },
    },
  };
}

function subscriptionUpdatedEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_sub_1",
    object: "event",
    type: "customer.subscription.updated",
    created: 2_000,
    data: {
      object: {
        object: "subscription",
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { ypnus_tier: "pro" },
        items: { object: "list", data: [{ price: { id: "price_pro_test", product: "prod_pro" } }] },
        ...overrides,
      },
    },
  };
}

describe("Direct Stripe webhook — /api/webhooks/stripe route", async () => {
  const { POST } = await import("./route");
  const { findRevenueSubscriptionByStripeSubscriptionId } = await import("@/lib/db");

  await it("rejects a request with a bad signature", async () => {
    const res = await POST(
      new Request("https://app.ypnus.com/api/webhooks/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
        body: JSON.stringify(checkoutSessionEvent()),
      }),
    );
    assert.equal(res.status, 400);
  });

  await it("claims the ZIP and resolves tier from metadata on checkout.session.completed", async () => {
    const res = await POST(signedRequest(checkoutSessionEvent()));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; applied: boolean; tier: string; zipClaimed: boolean };
    assert.equal(body.applied, true);
    assert.equal(body.tier, "growth");
    assert.equal(body.zipClaimed, true);

    const stored = findRevenueSubscriptionByStripeSubscriptionId("sub_1");
    assert.ok(stored);
    assert.deepEqual(stored?.claimedZips, ["93720"]);
  });

  await it("updates tier/status from customer.subscription.updated using subscription metadata", async () => {
    const res = await POST(signedRequest(subscriptionUpdatedEvent()));
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; applied: boolean; tier: string; status: string };
    assert.equal(body.applied, true);
    assert.equal(body.tier, "pro");
    assert.equal(body.status, "active");

    const stored = findRevenueSubscriptionByStripeSubscriptionId("sub_1");
    assert.equal(stored?.tier, "pro");
    // The earlier checkout event's claimed ZIP must survive an unrelated subscription update.
    assert.deepEqual(stored?.claimedZips, ["93720"]);
  });

  await it("still acks 200 for an event type it doesn't act on", async () => {
    const res = await POST(
      signedRequest({ id: "evt_ignore", object: "event", type: "invoice.payment_succeeded", created: 3_000, data: { object: {} } }),
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { applied: boolean };
    assert.equal(body.applied, false);
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
});
