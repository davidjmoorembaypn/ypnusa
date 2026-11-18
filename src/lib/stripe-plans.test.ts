import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-stripe-plans-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("Pro yearly and the extra ZIP code add-on", async () => {
  const { applyFulfillmentEvent } = await import("./fulfillment");
  const { entitlementForEmail, claimedZipsForEmail } = await import("./accounts");
  const { readDb, writeDb } = await import("./db");
  const { STRIPE_PLANS, stripePlanFrom } = await import("./stripe-plans");
  const { mapStripeEventToFulfillmentPayload } = await import("./stripe-webhook");

  let clock = 2_000_000_000;
  function checkout(sub: string, customer: string, email: string, zip: string, extra: Record<string, unknown>) {
    clock += 1;
    return applyFulfillmentEvent({
      stripeCustomerId: customer,
      stripeSubscriptionId: sub,
      zip,
      eventType: "checkout.session.completed",
      paymentStatus: "paid",
      customerEmail: email,
      eventCreatedAt: clock,
      eventId: `evt_${clock}`,
      ...extra,
    });
  }
  const record = (sub: string) => readDb().revenueSubscriptions.find((s) => s.stripeSubscriptionId === sub)!;

  afterEach(() =>
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    }),
  );
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("prices match what David approved", () => {
    assert.equal(STRIPE_PLANS.pro_yearly.priceCents, 99000);
    assert.equal(STRIPE_PLANS.extra_zip_monthly.priceCents, 7900);
    assert.equal(STRIPE_PLANS.extra_zip_yearly.priceCents, 79000);
  });

  it("recognises a plan from metadata only when it's a known key", () => {
    assert.equal(stripePlanFrom({ metadataPlan: " Pro_Yearly " }), "pro_yearly");
    assert.equal(stripePlanFrom({ metadataPlan: "free_forever" }), undefined);
    assert.equal(stripePlanFrom({ metadataPlan: "__proto__" }), undefined);
    assert.equal(stripePlanFrom({}), undefined);
  });

  it("the webhook passes ypnus_plan through from a checkout and a subscription", () => {
    const session = mapStripeEventToFulfillmentPayload({
      id: "evt_1",
      created: 1,
      type: "checkout.session.completed",
      data: {
        object: {
          mode: "subscription",
          subscription: "sub_1",
          customer: "cus_1",
          payment_status: "paid",
          client_reference_id: "93291",
          metadata: { ypnus_plan: "extra_zip_yearly" },
          payment_link: "plink_unknown",
          customer_details: { email: "a@example.com" },
        },
      },
    } as never);
    assert.equal(session?.plan, "extra_zip_yearly");
    const sub = mapStripeEventToFulfillmentPayload({
      id: "evt_2",
      created: 2,
      type: "customer.subscription.created",
      data: { object: { customer: "cus_1", id: "sub_1", status: "active", metadata: { ypnus_plan: "pro_yearly" }, items: { data: [] } } },
    } as never);
    assert.equal(sub?.plan, "pro_yearly");
  });

  it("Pro yearly grants Pro and locks the ZIP code at checkout", () => {
    const result = checkout("sub_year", "cus_year", "year@example.com", "93291", { plan: "pro_yearly" });
    assert.equal(result.ok && result.applied && result.tier, "growth");
    assert.deepEqual(record("sub_year").claimedZips, ["93291"]);
    assert.equal(record("sub_year").monthlyPriceCents, 8250);
    assert.equal(record("sub_year").addon, undefined);
    assert.equal(entitlementForEmail("year@example.com").tier, "growth");
  });

  it("an extra ZIP code holds its ZIP code but never grants a plan, and never lowers one", () => {
    checkout("sub_base", "cus_base", "lo@example.com", "93291", { tier: "elite" });
    const addon = checkout("sub_add", "cus_add", "lo@example.com", "93292", { plan: "extra_zip_monthly" });
    assert.equal(addon.ok && addon.applied && addon.tier, undefined);
    assert.equal(record("sub_add").addon, "extra_zip");
    assert.deepEqual(record("sub_add").claimedZips, ["93292"]);
    assert.deepEqual(claimedZipsForEmail("lo@example.com").sort(), ["93291", "93292"]);
    assert.equal(entitlementForEmail("lo@example.com").tier, "elite");

    // Bought alone, it gives no plan access.
    checkout("sub_alone", "cus_alone", "alone@example.com", "93611", { plan: "extra_zip_yearly" });
    assert.deepEqual(record("sub_alone").claimedZips, ["93611"]);
    assert.deepEqual(entitlementForEmail("alone@example.com"), { tier: "free", subscriptionStatus: "none" });
  });

  it("an add-on for a ZIP code someone else holds is flagged like any other paid checkout", () => {
    checkout("sub_a", "cus_a", "a@example.com", "93277", { tier: "growth" });
    checkout("sub_b", "cus_b", "b@example.com", "93277", { plan: "extra_zip_monthly" });
    assert.deepEqual(record("sub_b").claimedZips, []);
    assert.equal(record("sub_b").zipLockConflict?.zip, "93277");
  });
});
