import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PAID_PRICING_TIERS,
  PRICING_TIERS,
  getPricingTier,
  type PricingTierId,
} from "./pricing";

describe("pricing catalog", () => {
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

  it("prices the display string consistently with the billed cents", () => {
    for (const tier of PRICING_TIERS) {
      const dollars = Number(tier.price.replace(/[^0-9.]/g, ""));
      assert.equal(Math.round(dollars * 100), tier.priceMonthlyCents, `${tier.id} price mismatch`);
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
