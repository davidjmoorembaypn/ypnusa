import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CURRENT_PAID_TIER_IDS,
  PAID_PRICING_TIERS,
  PREPAID_5Y,
  PREPAID_5Y_REFUND_WINDOW_DAYS,
  PREPAID_5Y_YEARS,
  PUBLIC_MONTHLY_PRICE_CENTS,
  PUBLIC_PRICING_TIERS,
  PRICING_TIERS,
  getPricingTier,
  prepaid5ySavingsRatio,
  resolveTierFromStripeIdentifier,
  type PricingTierId,
} from "./pricing";

describe("pricing catalog", () => {
  it("offers only current plans while preserving legacy subscription resolution", () => {
    assert.deepEqual(PUBLIC_PRICING_TIERS.map((tier) => tier.id), ["free", "growth", "pro", "elite"]);
    assert.deepEqual(PUBLIC_PRICING_TIERS.map((tier) => tier.priceMonthlyCents), [0, 9999, 19999, 29999]);
    assert.equal(getPricingTier("starter").priceMonthlyCents, 2999);
  });
  it("exposes the five tiers in ascending price order with unique ids", () => {
    const ids = PRICING_TIERS.map((tier) => tier.id);

    assert.deepEqual(ids, ["free", "starter", "growth", "pro", "elite"]);
    assert.equal(new Set(ids).size, ids.length);

    const prices = PRICING_TIERS.map((tier) => tier.priceMonthlyCents);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it("marks exactly one tier as the highlighted upgrade path", () => {
    const highlighted = PRICING_TIERS.filter((tier) => tier.highlight);

    assert.equal(highlighted.length, 1);
    assert.equal(highlighted[0]?.id, "growth");
  });

  it("gives Free zero ZIPs and every paid tier exactly 1 included ZIP — higher plans buy capability, not more ZIPs", () => {
    const capacities = PRICING_TIERS.map((tier) => tier.zipCapacity);

    assert.deepEqual(capacities, [0, 1, 1, 1, 1]);
    for (const tier of PRICING_TIERS) {
      assert.ok(tier.capacityNote.length > 0, `${tier.id} is missing a capacity note`);
      assert.ok(tier.countyCapacityNote.length > 0, `${tier.id} is missing a county note`);
      assert.ok(tier.features.length > 0, `${tier.id} is missing features`);
      assert.ok(tier.cta.length > 0, `${tier.id} is missing a CTA`);
    }
  });

  it("prices the display string consistently with the billed cents (to the dollar)", () => {
    // Display shows the November 2026 whole-dollar prices; cents keep legacy subscribers' $x.99.
    for (const tier of PRICING_TIERS) {
      const dollars = Number(tier.price.replace(/[^0-9.]/g, ""));
      assert.equal(Math.floor(dollars), Math.floor(tier.priceMonthlyCents / 100), `${tier.id} price mismatch`);
    }
  });

  it("excludes the free tier from the paid list", () => {
    assert.deepEqual(
      PAID_PRICING_TIERS.map((tier) => tier.id),
      ["starter", "growth", "pro", "elite"],
    );
    assert.ok(PAID_PRICING_TIERS.every((tier) => tier.priceMonthlyCents > 0));
  });

  it("gives every paid tier the same 15-day trial and gives free tier none", () => {
    assert.equal(getPricingTier("free").trialDays, 0);
    for (const tier of PAID_PRICING_TIERS) {
      assert.equal(tier.trialDays, 15, `${tier.id} should have a 15-day trial`);
    }
  });
});

describe("getPricingTier", () => {
  it("resolves every catalog id", () => {
    for (const tier of PRICING_TIERS) {
      assert.equal(getPricingTier(tier.id), tier);
    }
  });

  it("throws instead of returning undefined for an unknown tier", () => {
    assert.throws(() => getPricingTier("platinum" as PricingTierId), {
      message: "Unknown pricing tier: platinum",
    });
  });
});

describe("resolveTierFromStripeIdentifier", () => {
  const ENV_KEYS = [
    "STRIPE_PRICE_ID_STARTER",
    "STRIPE_PRICE_ID_GROWTH",
    "STRIPE_PRICE_ID_PRO",
    "STRIPE_PRICE_ID_ELITE",
    "STRIPE_PRODUCT_ID_STARTER",
    "STRIPE_PRODUCT_ID_GROWTH",
    "STRIPE_PRODUCT_ID_PRO",
    "STRIPE_PRODUCT_ID_ELITE",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
  });

  it("resolves a configured priceId to its tier", () => {
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_123";
    assert.equal(resolveTierFromStripeIdentifier("price_pro_123", undefined), "pro");
  });

  it("resolves the growth tier like any other paid tier", () => {
    process.env.STRIPE_PRICE_ID_GROWTH = "price_growth_123";
    assert.equal(resolveTierFromStripeIdentifier("price_growth_123", undefined), "growth");
  });

  it("falls back to productId when priceId doesn't match", () => {
    process.env.STRIPE_PRICE_ID_ELITE = "price_elite_123";
    process.env.STRIPE_PRODUCT_ID_ELITE = "prod_elite_456";
    assert.equal(resolveTierFromStripeIdentifier("price_unknown", "prod_elite_456"), "elite");
  });

  it("returns null — never a default tier — when nothing matches or nothing is configured", () => {
    delete process.env.STRIPE_PRICE_ID_STARTER;
    delete process.env.STRIPE_PRODUCT_ID_STARTER;
    assert.equal(resolveTierFromStripeIdentifier("price_unrecognized", undefined), null);
    assert.equal(resolveTierFromStripeIdentifier(undefined, undefined), null);
  });
});

describe("5-year prepaid plans", () => {
  it("prices Pro $3,999, Growth $7,999 and Exclusive $11,999 (ids growth / pro / elite)", () => {
    assert.equal(PREPAID_5Y.growth.priceCents, 399900);
    assert.equal(PREPAID_5Y.pro.priceCents, 799900);
    assert.equal(PREPAID_5Y.elite.priceCents, 1199900);
  });

  it("compares against 60 months at the public monthly price ($5,940 / $11,940 / $17,940)", () => {
    assert.equal(PREPAID_5Y_YEARS, 5);
    assert.equal(PREPAID_5Y.growth.monthlyEquivalentCents, 594000);
    assert.equal(PREPAID_5Y.pro.monthlyEquivalentCents, 1194000);
    assert.equal(PREPAID_5Y.elite.monthlyEquivalentCents, 1794000);
  });

  it("keeps the public monthly price in step with each tier's displayed price", () => {
    for (const tierId of CURRENT_PAID_TIER_IDS) {
      const displayed = Number(getPricingTier(tierId).price.replace(/[^0-9.]/g, ""));
      assert.equal(PUBLIC_MONTHLY_PRICE_CENTS[tierId], displayed * 100, `${tierId} public price mismatch`);
      assert.equal(PREPAID_5Y[tierId].tierId, tierId);
    }
  });

  it("saves about a third on every plan, which is what the copy promises", () => {
    for (const tierId of CURRENT_PAID_TIER_IDS) {
      const ratio = prepaid5ySavingsRatio(tierId);
      assert.ok(ratio > 0.3 && ratio < 0.36, `${tierId} saves ${ratio}`);
    }
  });

  it("refunds in full only within 30 days of purchase", () => {
    assert.equal(PREPAID_5Y_REFUND_WINDOW_DAYS, 30);
  });
});

describe("plan feature copy", () => {
  it("never claims a trial locks a ZIP code, and drops the unbuilt branded experience", () => {
    for (const tier of PRICING_TIERS) {
      for (const feature of tier.features) {
        assert.doesNotMatch(feature, /Branded borrower experience/i, `${tier.id}: ${feature}`);
        if (/trial/i.test(feature)) assert.doesNotMatch(feature, /lock|reserve/i, `${tier.id}: ${feature}`);
      }
    }
  });
});

describe("plan entitlement matrix", () => {
  it("agrees with each plan card's feature list", async () => {
    const { PLAN_ENTITLEMENTS, getPricingTier } = await import("./pricing");
    const row = (label: string) => PLAN_ENTITLEMENTS.find((item) => item.label === label);
    const website = row("Portable MLO website");
    assert.ok(website);
    // The website is on Growth ($199, id "pro") and Exclusive ($299, id "elite") only.
    assert.deepEqual([website.free, website.growth, website.pro, website.elite], ["—", "—", "✓", "✓"]);
    assert.ok(getPricingTier("pro").features.includes("Portable MLO website"));
    assert.ok(!getPricingTier("growth").features.includes("Portable MLO website"));
    const zip = row("Exclusive ZIP code (locks at first payment)");
    assert.deepEqual([zip?.growth, zip?.pro, zip?.elite], ["1 included", "1 included", "1 included"]);
    // No fixed page counts anywhere in the matrix.
    assert.ok(PLAN_ENTITLEMENTS.every((item) => !/\d+\+/.test(item.label)));
  });
});
