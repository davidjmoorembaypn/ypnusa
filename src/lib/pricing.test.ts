import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  PAID_PRICING_TIERS,
  PRICING_TIERS,
  getPricingTier,
  resolveTierFromStripeIdentifier,
  type PricingTierId,
} from "./pricing";

describe("pricing catalog", () => {
  it("exposes the four tiers in ascending price order with unique ids", () => {
    const ids = PRICING_TIERS.map((tier) => tier.id);

    assert.deepEqual(ids, ["free", "starter", "pro", "elite"]);
    assert.equal(new Set(ids).size, ids.length);

    const prices = PRICING_TIERS.map((tier) => tier.priceMonthlyCents);
    assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  });

  it("marks exactly one tier as the highlighted upgrade path", () => {
    const highlighted = PRICING_TIERS.filter((tier) => tier.highlight);

    assert.equal(highlighted.length, 1);
    assert.equal(highlighted[0]?.id, "pro");
  });

  it("keeps ZIP capacity monotonic with price and unlimited only on Elite", () => {
    const capacities = PRICING_TIERS.map((tier) => tier.zipCapacity);

    assert.deepEqual(capacities, [1, 3, 5, "unlimited"]);
    for (const tier of PRICING_TIERS) {
      assert.ok(tier.capacityNote.length > 0, `${tier.id} is missing a capacity note`);
      assert.ok(tier.countyCapacityNote.length > 0, `${tier.id} is missing a county note`);
      assert.ok(tier.features.length > 0, `${tier.id} is missing features`);
      assert.ok(tier.cta.length > 0, `${tier.id} is missing a CTA`);
    }
  });

  it("prices the display string consistently with the billed cents", () => {
    for (const tier of PRICING_TIERS) {
      const dollars = Number(tier.price.replace(/[^0-9.]/g, ""));
      assert.equal(Math.round(dollars * 100), tier.priceMonthlyCents, `${tier.id} price mismatch`);
    }
  });

  it("excludes the free tier from the paid list", () => {
    assert.deepEqual(
      PAID_PRICING_TIERS.map((tier) => tier.id),
      ["starter", "pro", "elite"],
    );
    assert.ok(PAID_PRICING_TIERS.every((tier) => tier.priceMonthlyCents > 0));
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
    "STRIPE_PRICE_ID_PRO",
    "STRIPE_PRICE_ID_ELITE",
    "STRIPE_PRODUCT_ID_STARTER",
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
