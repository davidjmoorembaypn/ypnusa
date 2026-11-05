import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tierFromMetadata } from "./stripe-webhook";

describe("tierFromMetadata", () => {
  it("maps November 2026 public names to tier ids", () => {
    assert.equal(tierFromMetadata({ ypnus_tier: "pro", pricing: "2026-11" }), "growth");
    assert.equal(tierFromMetadata({ ypnus_tier: "growth", pricing: "2026-11" }), "pro");
    assert.equal(tierFromMetadata({ ypnus_tier: "exclusive", pricing: "2026-11" }), "elite");
  });

  it("keeps older links' tier ids as they are", () => {
    assert.equal(tierFromMetadata({ ypnus_tier: "growth" }), "growth");
    assert.equal(tierFromMetadata({ ypnus_tier: "pro" }), "pro");
    assert.equal(tierFromMetadata({ ypnus_tier: "elite" }), "elite");
  });

  it("treats exclusive as elite even without the pricing tag", () => {
    assert.equal(tierFromMetadata({ ypnus_tier: "Exclusive" }), "elite");
  });

  it("returns undefined without tier metadata", () => {
    assert.equal(tierFromMetadata(undefined), undefined);
    assert.equal(tierFromMetadata({}), undefined);
  });
});
