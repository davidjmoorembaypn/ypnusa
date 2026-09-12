import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-fulfill-webhook-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "store.json"), JSON.stringify({ demoRequests: [] }));

process.env.LAMBDA_FULFILLMENT_SECRET = "test-lambda-secret";
process.env.STRIPE_PRICE_ID_PRO = "price_pro_test";

const SECRET_HEADER = { "x-internal-secret": "test-lambda-secret" };

function post(body: unknown, headers: Record<string, string> = SECRET_HEADER): Request {
  return new Request("https://app.ypnus.com/api/webhooks/fulfill", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function checkoutPayload(overrides: Record<string, unknown> = {}) {
  return {
    stripeCustomerId: "cus_1",
    stripeSubscriptionId: "sub_1",
    eventType: "checkout.session.completed",
    eventCreatedAt: 1_000,
    paymentStatus: "paid",
    priceId: "price_pro_test",
    ...overrides,
  };
}

describe("Lambda Stripe-fulfillment webhook — /api/webhooks/fulfill route", async () => {
  const { POST } = await import("./route");
  const { findRevenueSubscriptionByStripeSubscriptionId } = await import("@/lib/db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("rejects when no internal secret is configured or the wrong one is supplied", async () => {
    const original = process.env.LAMBDA_FULFILLMENT_SECRET;
    delete process.env.LAMBDA_FULFILLMENT_SECRET;
    assert.equal((await POST(post(checkoutPayload()))).status, 401);
    process.env.LAMBDA_FULFILLMENT_SECRET = original;

    assert.equal(
      (await POST(post(checkoutPayload(), { "x-internal-secret": "wrong" }))).status,
      401,
    );
  });

  it("rejects a payload missing required fields", async () => {
    const res = await POST(post({ eventType: "checkout.session.completed" }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "INVALID_FULFILLMENT_PAYLOAD");
  });

  it("activates the resolved tier on a paid checkout.session.completed", async () => {
    const res = await POST(post(checkoutPayload({ stripeSubscriptionId: "sub_paid" })));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.applied, true);
    assert.equal(body.tier, "pro");
    assert.equal(body.status, "active");

    const stored = findRevenueSubscriptionByStripeSubscriptionId("sub_paid");
    assert.equal(stored?.tier, "pro");
    assert.equal(stored?.status, "active");
  });

  it("does NOT activate an unpaid checkout — payment_status must be verified first", async () => {
    const res = await POST(
      post(checkoutPayload({ stripeSubscriptionId: "sub_unpaid", paymentStatus: "unpaid" })),
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.applied, false);
    assert.match(body.reason, /payment_status=unpaid/);
    assert.equal(findRevenueSubscriptionByStripeSubscriptionId("sub_unpaid"), null);
  });

  it("rejects an unrecognized priceId instead of defaulting to a tier", async () => {
    const res = await POST(
      post(checkoutPayload({ stripeSubscriptionId: "sub_unknown_price", priceId: "price_unknown" })),
    );
    assert.equal(res.status, 422);
    assert.equal((await res.json()).code, "UNRECOGNIZED_STRIPE_PRICE");
  });

  it("cancels an existing subscription on customer.subscription.deleted", async () => {
    await POST(post(checkoutPayload({ stripeSubscriptionId: "sub_to_cancel", eventCreatedAt: 1_000 })));

    const res = await POST(
      post({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_to_cancel",
        eventType: "customer.subscription.deleted",
        eventCreatedAt: 2_000,
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, "cancelled");
    assert.equal(findRevenueSubscriptionByStripeSubscriptionId("sub_to_cancel")?.status, "cancelled");
  });

  it("no-ops a subscription.deleted for a subscription id that was never provisioned", async () => {
    const res = await POST(
      post({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_never_seen",
        eventType: "customer.subscription.deleted",
        eventCreatedAt: 1_000,
      }),
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).applied, false);
  });

  it("rejects a stale/out-of-order event instead of overwriting newer state", async () => {
    await POST(post(checkoutPayload({ stripeSubscriptionId: "sub_ordering", eventCreatedAt: 5_000 })));
    await POST(
      post({
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_ordering",
        eventType: "customer.subscription.deleted",
        eventCreatedAt: 6_000,
      }),
    );

    // A delayed retry of the original (older) checkout.session.completed arrives after the
    // cancellation — it must not reactivate the subscription.
    const res = await POST(
      post(checkoutPayload({ stripeSubscriptionId: "sub_ordering", eventCreatedAt: 5_000 })),
    );
    assert.equal((await res.json()).applied, false);
    assert.equal(
      findRevenueSubscriptionByStripeSubscriptionId("sub_ordering")?.status,
      "cancelled",
      "the stale event must not reactivate an already-cancelled subscription",
    );
  });

  it("keys by stripeSubscriptionId — cancelling one of a customer's subscriptions leaves their other one active", async () => {
    await POST(
      post(
        checkoutPayload({
          stripeCustomerId: "cus_multi",
          stripeSubscriptionId: "sub_multi_a",
          eventCreatedAt: 1_000,
        }),
      ),
    );
    await POST(
      post(
        checkoutPayload({
          stripeCustomerId: "cus_multi",
          stripeSubscriptionId: "sub_multi_b",
          eventCreatedAt: 1_000,
        }),
      ),
    );

    await POST(
      post({
        stripeCustomerId: "cus_multi",
        stripeSubscriptionId: "sub_multi_a",
        eventType: "customer.subscription.deleted",
        eventCreatedAt: 2_000,
      }),
    );

    assert.equal(findRevenueSubscriptionByStripeSubscriptionId("sub_multi_a")?.status, "cancelled");
    assert.equal(
      findRevenueSubscriptionByStripeSubscriptionId("sub_multi_b")?.status,
      "active",
      "cancelling one subscription must not affect the customer's other subscription",
    );
  });
});
