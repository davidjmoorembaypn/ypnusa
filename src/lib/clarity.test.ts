import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clarityTagUrl, normalizeClarityId, shouldRecordWithClarity } from "./clarity";

describe("clarity", () => {
  it("accepts a real project ID and rejects junk", () => {
    assert.equal(normalizeClarityId("x214y1lr5s"), "x214y1lr5s");
    assert.equal(normalizeClarityId("  X214Y1LR5S "), "x214y1lr5s");
    assert.equal(normalizeClarityId(undefined), null);
    assert.equal(normalizeClarityId(""), null);
    assert.equal(normalizeClarityId("abc'+alert(1)+'"), null);
  });

  it("records public marketing pages", () => {
    for (const path of ["/", "/pricing", "/check-zip", "/zip/93618", "/blog/some-post", "/sms-opt-in"]) {
      assert.equal(shouldRecordWithClarity(path), true, path);
    }
  });

  it("never records app, admin, embed or borrower pages", () => {
    for (const path of ["/dashboard", "/dashboard/leads", "/admin", "/account", "/billing", "/login", "/onboarding", "/portal/x", "/embed/cerebro", "/lo/jane-doe", "/api/health", "/analytics"]) {
      assert.equal(shouldRecordWithClarity(path), false, path);
    }
    assert.equal(shouldRecordWithClarity(null), false);
  });

  it("builds the tag URL", () => {
    assert.equal(clarityTagUrl("x214y1lr5s"), "https://www.clarity.ms/tag/x214y1lr5s");
  });
});
