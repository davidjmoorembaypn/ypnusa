import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeRoi, formatCoverage, parseDollarInput, parseLoanCountInput, planYearlyCosts } from "./roi";

describe("planYearlyCosts", () => {
  it("shows $1,188 / $2,388 / $3,588 a year monthly, and the 5-year price spread over 5 years", () => {
    assert.deepEqual(
      planYearlyCosts().map((row) => [row.name, row.monthlyPlanYearlyCents, row.prepaidYearlyCents]),
      [
        ["Pro", 118800, 79980],
        ["Growth", 238800, 159980],
        ["Exclusive", 358800, 239980],
      ],
    );
  });
});

describe("parseDollarInput", () => {
  it("accepts typed amounts with $, commas and spaces", () => {
    assert.equal(parseDollarInput("3,000"), 3000);
    assert.equal(parseDollarInput("$ 2500.50"), 2500.5);
  });

  it("rejects blanks and non-numbers", () => {
    assert.equal(parseDollarInput(""), null);
    assert.equal(parseDollarInput("abc"), null);
    assert.equal(parseDollarInput("-300"), null);
  });
});

describe("parseLoanCountInput", () => {
  it("defaults a blank field to 1 extra loan", () => {
    assert.equal(parseLoanCountInput(""), 1);
    assert.equal(parseLoanCountInput("3"), 3);
  });

  it("rejects negatives and text", () => {
    assert.equal(parseLoanCountInput("-1"), null);
    assert.equal(parseLoanCountInput("two"), null);
  });
});

describe("computeRoi", () => {
  it("returns nothing until there is a positive commission and loan count", () => {
    assert.equal(computeRoi(null, 1), null);
    assert.equal(computeRoi(0, 1), null);
    assert.equal(computeRoi(3000, 0), null);
    assert.equal(computeRoi(3000, null), null);
  });

  it("divides one year's extra commission by each plan's yearly cost", () => {
    const result = computeRoi(3000, 1);
    assert.ok(result);
    assert.equal(result.extraCommissionYearlyCents, 300000);
    const pro = result.rows.find((row) => row.tierId === "growth");
    assert.ok(pro);
    assert.equal(pro.monthlyCoverage, 300000 / 118800);
    assert.equal(pro.prepaidCoverage, 300000 / 79980);
  });

  it("scales with extra loans per year", () => {
    const one = computeRoi(3000, 1);
    const two = computeRoi(3000, 2);
    assert.ok(one && two);
    assert.equal(two.rows[0].monthlyCoverage, one.rows[0].monthlyCoverage * 2);
  });
});

describe("formatCoverage", () => {
  it("shows one decimal under 10 and rounds down so a shortfall is never shown as covered", () => {
    assert.equal(formatCoverage(300000 / 118800), "2.5×");
    assert.equal(formatCoverage(0.99), "0.9×");
    assert.equal(formatCoverage(12.8), "12×");
    assert.equal(formatCoverage(0), "0×");
    assert.equal(formatCoverage(Number.NaN), "0×");
  });
});
