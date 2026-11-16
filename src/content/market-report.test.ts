import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LATEST_YEAR,
  PREVIOUS_YEAR,
  REPORT_COUNTIES,
  REPORT_YEARS,
  averageLoan,
  countyTakeaways,
  formatChange,
  getReportCounty,
  percentChange,
  regionTotals,
  sharePercent,
} from "./market-report";

describe("market report data (HMDA)", () => {
  it("has unique slugs and FIPS codes", () => {
    const slugs = new Set(REPORT_COUNTIES.map((c) => c.slug));
    const fips = new Set(REPORT_COUNTIES.map((c) => c.fips));
    assert.equal(slugs.size, REPORT_COUNTIES.length);
    assert.equal(fips.size, REPORT_COUNTIES.length);
    for (const c of REPORT_COUNTIES) {
      assert.match(c.slug, /^[a-z0-9-]+-county-[a-z]{2}$/, c.slug);
      assert.match(c.fips, /^\d{5}$/, c.fips);
    }
  });

  it("loan-type counts add up exactly to the county total (catches copy errors)", () => {
    for (const c of REPORT_COUNTIES) {
      for (const year of REPORT_YEARS) {
        const y = c.years[year];
        const types = y.loanTypes.conventional.count + y.loanTypes.fha.count + y.loanTypes.va.count + y.loanTypes.usda.count;
        assert.equal(types, y.total.count, `${c.name} ${year}`);
      }
    }
  });

  it("loan-purpose counts never exceed the total, and miss at most 1% (purpose 5, not applicable)", () => {
    for (const c of REPORT_COUNTIES) {
      for (const year of REPORT_YEARS) {
        const p = c.years[year].purposes;
        const sum = p.purchase.count + p.homeImprovement.count + p.refinance.count + p.cashOutRefinance.count + p.other.count;
        const total = c.years[year].total.count;
        assert.ok(sum <= total, `${c.name} ${year}: ${sum} > ${total}`);
        assert.ok(sum >= total * 0.99, `${c.name} ${year}: ${sum} far below ${total}`);
      }
    }
  });

  it("dollar sums stay within a few percent of the total across loan types", () => {
    for (const c of REPORT_COUNTIES) {
      for (const year of REPORT_YEARS) {
        const y = c.years[year];
        const types = y.loanTypes.conventional.sum + y.loanTypes.fha.sum + y.loanTypes.va.sum + y.loanTypes.usda.sum;
        assert.ok(Math.abs(types - y.total.sum) / y.total.sum < 0.001, `${c.name} ${year}`);
      }
    }
  });

  it("looks up counties by slug", () => {
    assert.equal(getReportCounty("tulare-county-ca")?.fips, "06107");
    assert.equal(getReportCounty("nowhere-county-zz"), undefined);
  });
});

describe("market report math", () => {
  it("computes percent change and share with one decimal", () => {
    assert.equal(percentChange(100, 118), 18);
    assert.equal(percentChange(4407, 5725), 29.9);
    assert.equal(percentChange(0, 5), null);
    assert.equal(sharePercent(1, 3), 33.3);
    assert.equal(sharePercent(1, 0), 0);
  });

  it("formats changes with a sign", () => {
    assert.equal(formatChange(12.5), "+12.5%");
    assert.equal(formatChange(-3), "-3%");
    assert.equal(formatChange(null), "n/a");
  });

  it("rounds the average loan to the nearest $1,000", () => {
    assert.equal(averageLoan({ count: 3, sum: 1_000_000 }), 333_000);
    assert.equal(averageLoan({ count: 0, sum: 0 }), 0);
  });

  it("sums the region from every county", () => {
    const totals = regionTotals(LATEST_YEAR);
    const expected = REPORT_COUNTIES.reduce((n, c) => n + c.years[LATEST_YEAR].total.count, 0);
    assert.equal(totals.total.count, expected);
    assert.ok(totals.purposes.purchase.count > 0);
  });

  it("writes takeaways only from the county's own numbers", () => {
    const tulare = getReportCounty("tulare-county-ca")!;
    const lines = countyTakeaways(tulare);
    assert.ok(lines[0].includes("5,725") && lines[0].includes("4,407") && lines[0].includes("up 29.9%"), lines[0]);
    for (const line of lines) {
      assert.doesNotMatch(line, /rate|APR|guarantee|best|top lender/i, line);
    }
    assert.ok(lines.some((l) => l.includes(String(LATEST_YEAR))));
    assert.ok(lines.some((l) => l.includes(String(PREVIOUS_YEAR))));
  });
});
