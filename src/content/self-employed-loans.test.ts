import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "@/app/sitemap";
import { REPORT_COUNTIES } from "@/content/market-report";
import {
  BANK_STATEMENT_CONTENT,
  BANK_STATEMENT_PATH,
  DSCR_CALIFORNIA_FAQS,
  SELF_EMPLOYED_COUNTY_ANGLES,
  SELF_EMPLOYED_HUB,
  SELF_EMPLOYED_HUB_PATH,
  countyDataSentence,
  countyFaqs,
  countyLoanFacts,
  countyShortAnswer,
  getSelfEmployedCounty,
  selfEmployedCountyPath,
  selfEmployedFunnelSource,
  selfEmployedPathForCountyName,
} from "./self-employed-loans";
import { parseFunnelSourceParam } from "@/lib/local-seo";

/** Language these borrower pages must never use: rate quotes, payment estimates, approval promises, the old name. */
const FORBIDDEN = [
  /\d+(\.\d+)?\s*%\s*(apr|interest|rate)/i,
  /\$\s?\d[\d,]*\s*(\/|per)\s*(mo|month)/i,
  /\bguarantee/i,
  /pre-?approved in/i,
  /you(?:'ll| will) (?:be approved|qualify)/i,
  /no credit check/i,
  /Young Professional/i,
];

function assertClean(label: string, text: string) {
  for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `${label} matches ${pattern}`);
}

describe("self-employed and investor pages", () => {
  it("covers every Central Valley report county with its own copy", () => {
    for (const county of REPORT_COUNTIES) {
      assert.ok(getSelfEmployedCounty(county.slug), county.slug);
    }
    const borrowerLines = Object.values(SELF_EMPLOYED_COUNTY_ANGLES).map((a) => a.borrowers);
    const investorLines = Object.values(SELF_EMPLOYED_COUNTY_ANGLES).map((a) => a.investors);
    assert.equal(new Set(borrowerLines).size, borrowerLines.length, "borrower copy is unique per county");
    assert.equal(new Set(investorLines).size, investorLines.length, "investor copy is unique per county");
  });

  it("states county numbers that match the HMDA data", () => {
    for (const county of REPORT_COUNTIES) {
      const facts = countyLoanFacts(county);
      assert.equal(facts.total, county.years[2024].total.count);
      assert.ok(countyDataSentence(county).includes(facts.total.toLocaleString("en-US")), county.slug);
    }
  });

  it("uses no rate, payment, approval or old-brand language", () => {
    assertClean("bank statement", JSON.stringify(BANK_STATEMENT_CONTENT));
    assertClean("dscr faqs", JSON.stringify(DSCR_CALIFORNIA_FAQS));
    assertClean("hub", JSON.stringify(SELF_EMPLOYED_HUB));
    for (const county of REPORT_COUNTIES) {
      const all = [countyShortAnswer(county), countyDataSentence(county), JSON.stringify(countyFaqs(county)), JSON.stringify(SELF_EMPLOYED_COUNTY_ANGLES[county.slug])].join(" ");
      assertClean(county.slug, all);
    }
  });

  it("answers first and carries an FAQ on every page", () => {
    assert.ok(SELF_EMPLOYED_HUB.shortAnswer.split(/\s+/).length <= 80);
    assert.ok(SELF_EMPLOYED_HUB.faqs.length >= 3);
    assert.ok(BANK_STATEMENT_CONTENT.faqs.length >= 3);
    for (const county of REPORT_COUNTIES) {
      assert.ok(countyShortAnswer(county).split(/\s+/).length <= 80, county.slug);
      assert.ok(countyFaqs(county).length >= 3, county.slug);
    }
  });

  it("tags borrower intake with a funnel source the intake accepts", () => {
    for (const county of REPORT_COUNTIES) {
      const source = selfEmployedFunnelSource(county);
      assert.equal(parseFunnelSourceParam(source), source, source);
    }
  });

  it("links city and ZIP code pages to their county page", () => {
    assert.equal(selfEmployedPathForCountyName("Fresno County"), "/self-employed-mortgage/fresno-county-ca");
    assert.equal(selfEmployedPathForCountyName("Nowhere County"), undefined);
  });

  it("puts every new page in the sitemap", () => {
    const urls = new Set(sitemap().map((entry) => new URL(entry.url).pathname));
    for (const path of [BANK_STATEMENT_PATH, SELF_EMPLOYED_HUB_PATH, ...REPORT_COUNTIES.map(selfEmployedCountyPath)]) {
      assert.ok(urls.has(path), path);
    }
  });
});
