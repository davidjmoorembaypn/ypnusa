import { monthlyPrincipalAndInterest } from "../home-calc";
import type { AiToolDefinition } from "./provider";

const amount = (description: string) => ({ type: "number", description });
export const MORTGAGE_SCENARIO: AiToolDefinition = {
  name: "calculate_mortgage_scenario",
  description: "Calculate a hypothetical fixed-rate purchase with an optional initial interest-only period, including the payment when principal repayment starts. All money is USD. Ask for missing assumptions.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["price", "downPayment", "ratePct", "termYears"],
    properties: {
      price: amount("Purchase price"), downPayment: amount("Cash down in dollars"),
      ratePct: amount("User-supplied hypothetical annual note rate in percent"), termYears: amount("Whole years to maturity"),
      interestOnlyYears: amount("Initial whole years paying interest only; same assumed rate thereafter"),
    },
  },
};
export const PROPERTY_SCENARIO: AiToolDefinition = {
  name: "calculate_income_property",
  description: "Calculate property NOI, cap rate and optional implied value, commercial NOI-based DSCR, and cash flow before tax and capital expenditures. Use annual figures. Residential lender rent/PITIA DSCR is a different measure.",
  inputSchema: {
    type: "object", additionalProperties: false, required: ["price","effectiveAnnualIncome","annualOperatingExpenses"],
    properties: {
      price: amount("Property purchase price"), effectiveAnnualIncome: amount("Annual property income after vacancies and credit losses"),
      annualOperatingExpenses: amount("Annual operating expenses including property tax and insurance, excluding debt, depreciation and capital expenditures"),
      annualDebtService: amount("Total annual debt service for all loans"), targetCapPct: amount("Assumed positive capitalization rate in percent for income-based valuation"),
    },
  },
};

function numeric(input: Record<string, unknown>, key: string, min: number, max: number) {
  const value = input[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error("Supply " + key + " as a finite number between " + min + " and " + max + ".");
  }
  return value;
}

export function calculateScenario(name: string, input: Record<string, unknown>) {
  const price = numeric(input, "price", 0.01, Number.MAX_SAFE_INTEGER);
  if (name === MORTGAGE_SCENARIO.name) {
    const down = numeric(input, "downPayment", 0, price);
    const rate = numeric(input, "ratePct", 0, 100);
    const term = numeric(input, "termYears", 1, 100);
    const io = input.interestOnlyYears === undefined ? 0 : numeric(input, "interestOnlyYears", 0, term);
    if (!Number.isInteger(term) || !Number.isInteger(io) || io >= term) throw new Error("Use whole years and an interest-only period shorter than the term.");
    const loan = price - down;
    return {
      assumptions: { price, downPayment: down, annualRatePct: rate, termYears: term, interestOnlyYears: io },
      loanAmount: loan, purchasePriceLtvPct: loan / price * 100,
      monthlyInterestOnly: io ? loan * rate / 1200 : null,
      monthlyPrincipalAndInterest: monthlyPrincipalAndInterest(loan, rate, term - io),
      amortizationYears: term - io,
      excludes: "Taxes, insurance, HOA dues, mortgage insurance and fees. Constant hypothetical rate, no prepayments.",
    };
  }
  if (name !== PROPERTY_SCENARIO.name) throw new Error("Unknown calculation.");
  const income = numeric(input, "effectiveAnnualIncome", 0, Number.MAX_SAFE_INTEGER);
  const expenses = numeric(input, "annualOperatingExpenses", 0, Number.MAX_SAFE_INTEGER);
  const debt = input.annualDebtService === undefined ? null : numeric(input, "annualDebtService", 0, Number.MAX_SAFE_INTEGER);
  const cap = input.targetCapPct === undefined ? null : numeric(input, "targetCapPct", 0.0001, 100);
  const noi = income - expenses;
  return {
    assumptions: { price, effectiveAnnualIncome: income, annualOperatingExpenses: expenses, annualDebtService: debt, targetCapPct: cap },
    annualNOI: noi, goingInCapRatePct: noi / price * 100,
    noiDebtServiceCoverageRatio: debt ? noi / debt : null,
    annualCashFlowBeforeCapexAndTax: debt === null ? null : noi - debt,
    impliedValueAtTargetCap: cap && noi > 0 ? noi / (cap / 100) : null,
  };
}
