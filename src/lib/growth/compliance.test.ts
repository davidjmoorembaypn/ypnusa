import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkMarketingCompliance } from "./compliance";

const ids = (text: string, channel?: "social" | "email" | "sms" | "ad") =>
  checkMarketingCompliance(text, channel).findings.map((finding) => finding.id);

const CLEAN =
  "Buying a home? I can walk you through your options. David J. Moore, MBA, NMLS #787257. Equal Housing Opportunity.";

describe("marketing compliance screen", () => {
  it("passes clean, properly identified copy", () => {
    const result = checkMarketingCompliance(CLEAN, "social");
    assert.deepEqual(result.findings, []);
    assert.equal(result.readyForReview, true);
  });

  it("requires something to check", () => {
    const result = checkMarketingCompliance("   ");
    assert.equal(result.readyForReview, false);
    assert.equal(result.findings[0].id, "empty");
  });

  it("flags promised approval and superlative rate claims as must-fix", () => {
    const result = checkMarketingCompliance(
      `Guaranteed approval and the lowest rates in town! NMLS #787257 Equal Housing Opportunity`,
    );
    assert.equal(result.readyForReview, false);
    assert.ok(result.findings.map((f) => f.id).includes("guaranteed_approval"));
    assert.ok(result.findings.map((f) => f.id).includes("superlative_rate_claim"));
  });

  it("asks for NMLS and Equal Housing when missing", () => {
    const found = ids("Thinking about buying a home this year? Let's talk.");
    assert.ok(found.includes("missing_nmls"));
    assert.ok(found.includes("missing_equal_housing"));
  });

  it("recognises common NMLS formats", () => {
    for (const nmls of ["NMLS #787257", "NMLS ID 787257", "NMLS# 787257", "NMLS: 787257", "nmls 787257"]) {
      assert.ok(!ids(`Hello. ${nmls}`).includes("missing_nmls"), nmls);
    }
  });

  it("flags rate, payment and down-payment figures for disclosure review", () => {
    for (const text of ["Rates as low as 5.5% APR", "Payments from $1,200/mo", "Just 3% down!"]) {
      assert.ok(ids(`${text} NMLS #787257 Equal Housing`).includes("trigger_terms"), text);
    }
  });

  it("flags pre-approval wording, government affiliation, urgency and no-cost claims for review", () => {
    const found = ids(
      "Get pre-approved today, FHA approved, act now! No closing costs. NMLS #787257 Equal Housing",
    );
    for (const id of ["preapproved_wording", "government_affiliation", "urgency_pressure", "no_cost_claim"]) {
      assert.ok(found.includes(id), id);
    }
  });

  it("flags fair-housing preference language as must-fix", () => {
    const result = checkMarketingCompliance(
      "Perfect for young couples, no kids. NMLS #787257 Equal Housing Opportunity",
    );
    assert.equal(result.readyForReview, false);
    assert.ok(result.findings.map((f) => f.id).includes("fair_housing_preference"));
  });

  it("flags a Social Security number pattern", () => {
    assert.ok(ids("My SSN is 123-45-6789 NMLS #787257 Equal Housing").includes("sensitive_number"));
  });

  it("requires unsubscribe for email and recommends a postal address", () => {
    const missing = ids(CLEAN, "email");
    assert.ok(missing.includes("email_missing_unsubscribe"));
    assert.ok(missing.includes("email_missing_address"));
    const ok = ids(
      `${CLEAN} YPN Inc., 247 N L Street, Dinuba, CA 93618. Unsubscribe any time.`,
      "email",
    );
    assert.ok(!ok.includes("email_missing_unsubscribe"));
    assert.ok(!ok.includes("email_missing_address"));
  });

  it("requires opt-out language for text messages", () => {
    assert.ok(ids(CLEAN, "sms").includes("sms_missing_stop"));
    assert.ok(!ids(`${CLEAN} Reply STOP to opt out.`, "sms").includes("sms_missing_stop"));
  });

  it("lists must-fix items before review items", () => {
    const result = checkMarketingCompliance("Guaranteed approval! Act now.");
    const severities = result.findings.map((f) => f.severity);
    assert.equal(severities.indexOf("review") > severities.lastIndexOf("fix"), true);
  });

  it("does not flag the owner's approved launch messages as must-fix", () => {
    const linkedin =
      "Most lead vendors sell the same borrower inquiry to several loan officers. I built the opposite: one YPN loan officer per zip code, plus an AI assistant that answers and qualifies borrowers in that area around the clock. There's a free plan. Paid plans start with a 15-day trial (card required, cancel online anytime). David J. Moore, MBA · NMLS #787257";
    const result = checkMarketingCompliance(linkedin, "social");
    assert.equal(result.readyForReview, true, JSON.stringify(result.findings));
  });
});
