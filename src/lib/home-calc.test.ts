import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { downPaymentPercent, maxHomePrice, monthlyPrincipalAndInterest, paymentBreakdown } from "./home-calc";

const near = (actual: number, expected: number, tolerance = 0.01) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

describe("home payment math", () => {
  it("matches the standard amortization figure", () => {
    // $400,000 at 6% over 30 years is $2,398.20 a month.
    near(monthlyPrincipalAndInterest(400_000, 6, 30), 2398.2);
    // $200,000 at 0% over 15 years is straight division.
    near(monthlyPrincipalAndInterest(200_000, 0, 15), 200_000 / 180);
  });

  it("returns zero rather than NaN for empty or invalid input", () => {
    assert.equal(monthlyPrincipalAndInterest(0, 6, 30), 0);
    assert.equal(monthlyPrincipalAndInterest(300_000, 6, 0), 0);
    assert.equal(monthlyPrincipalAndInterest(Number.NaN, 6, 30), 0);
    assert.equal(paymentBreakdown({ homePrice: 0, downPayment: 0, annualRatePct: 6, termYears: 30 }).total, 0);
  });

  it("charges PMI only below 20% down", () => {
    const low = paymentBreakdown({ homePrice: 500_000, downPayment: 49_999, annualRatePct: 6.5, termYears: 30 });
    const exactly20 = paymentBreakdown({ homePrice: 500_000, downPayment: 100_000, annualRatePct: 6.5, termYears: 30 });
    assert.ok(low.pmi > 0);
    assert.equal(exactly20.pmi, 0);
    assert.equal(exactly20.downPaymentPct, 20);
  });

  it("adds the pieces up and caps the down payment at the price", () => {
    const b = paymentBreakdown({ homePrice: 400_000, downPayment: 80_000, annualRatePct: 6, termYears: 30 });
    near(b.total, b.principalAndInterest + b.propertyTax + b.insurance + b.pmi, 1e-9);
    assert.equal(b.loanAmount, 320_000);
    const capped = paymentBreakdown({ homePrice: 100_000, downPayment: 250_000, annualRatePct: 6, termYears: 30 });
    assert.equal(capped.loanAmount, 0);
    assert.equal(downPaymentPercent(100_000, 250_000), 100);
  });

  it("a shorter term costs more per month for the same loan", () => {
    const thirty = monthlyPrincipalAndInterest(300_000, 6.5, 30);
    const fifteen = monthlyPrincipalAndInterest(300_000, 6.5, 15);
    assert.ok(fifteen > thirty);
  });
});

describe("max home price by monthly budget", () => {
  it("lands back on the budget when fed through the payment calculator", () => {
    for (const downPct of [3.5, 10, 20, 35]) {
      for (const termYears of [15, 30]) {
        const r = maxHomePrice({ monthlyBudget: 3500, downPaymentPct: downPct, annualRatePct: 6.5, termYears });
        near(r.breakdown.total, 3500, 0.01);
        near(r.breakdown.downPaymentPct, downPct, 1e-6);
      }
    }
  });

  it("a bigger budget or a lower rate buys more house", () => {
    const base = maxHomePrice({ monthlyBudget: 3000, downPaymentPct: 10, annualRatePct: 6.5, termYears: 30 });
    const more = maxHomePrice({ monthlyBudget: 4000, downPaymentPct: 10, annualRatePct: 6.5, termYears: 30 });
    const cheaper = maxHomePrice({ monthlyBudget: 3000, downPaymentPct: 10, annualRatePct: 5.5, termYears: 30 });
    assert.ok(more.maxHomePrice > base.maxHomePrice);
    assert.ok(cheaper.maxHomePrice > base.maxHomePrice);
  });

  it("returns zero for a zero or invalid budget", () => {
    assert.equal(maxHomePrice({ monthlyBudget: 0, downPaymentPct: 10, annualRatePct: 6.5, termYears: 30 }).maxHomePrice, 0);
    assert.equal(maxHomePrice({ monthlyBudget: Number.NaN, downPaymentPct: 10, annualRatePct: 6.5, termYears: 30 }).maxHomePrice, 0);
  });
});
