/**
 * Home payment and buying-power math for the white-label calculator preview.
 *
 * Everything here is an estimate for illustration. Taxes, insurance and PMI vary by property,
 * lender and borrower, so the defaults below are labeled on the page and are never a quote.
 */

/** Estimated annual property tax as a share of home price. */
export const DEFAULT_TAX_RATE_PCT = 1.1;
/** Estimated annual homeowners insurance as a share of home price. */
export const DEFAULT_INSURANCE_RATE_PCT = 0.35;
/** Estimated annual PMI as a share of the loan, charged only below 20% down. */
export const DEFAULT_PMI_RATE_PCT = 0.55;
/** Down payment share at which PMI stops being estimated. */
export const PMI_DOWN_PAYMENT_THRESHOLD_PCT = 20;

export interface Assumptions {
  taxRatePct: number;
  insuranceRatePct: number;
  pmiRatePct: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  taxRatePct: DEFAULT_TAX_RATE_PCT,
  insuranceRatePct: DEFAULT_INSURANCE_RATE_PCT,
  pmiRatePct: DEFAULT_PMI_RATE_PCT,
};

export interface PaymentInput {
  homePrice: number;
  downPayment: number;
  annualRatePct: number;
  termYears: number;
}

export interface PaymentBreakdown {
  loanAmount: number;
  downPaymentPct: number;
  principalAndInterest: number;
  propertyTax: number;
  insurance: number;
  pmi: number;
  total: number;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

/** Monthly principal and interest on a fixed-rate loan. */
export function monthlyPrincipalAndInterest(loanAmount: number, annualRatePct: number, termYears: number): number {
  const principal = Math.max(0, finite(loanAmount));
  const n = Math.round(finite(termYears) * 12);
  if (principal === 0 || n <= 0) return 0;
  const r = Math.max(0, finite(annualRatePct)) / 100 / 12;
  if (r === 0) return principal / n;
  const growth = Math.pow(1 + r, n);
  return (principal * r * growth) / (growth - 1);
}

/** Share of the price that is paid down, as a percentage clamped to 0-100. */
export function downPaymentPercent(homePrice: number, downPayment: number): number {
  if (!(homePrice > 0)) return 0;
  return Math.min(100, Math.max(0, (finite(downPayment) / homePrice) * 100));
}

export function paymentBreakdown(input: PaymentInput, assumptions: Assumptions = DEFAULT_ASSUMPTIONS): PaymentBreakdown {
  const homePrice = Math.max(0, finite(input.homePrice));
  const downPayment = Math.min(homePrice, Math.max(0, finite(input.downPayment)));
  const loanAmount = homePrice - downPayment;
  const downPaymentPct = downPaymentPercent(homePrice, downPayment);
  const principalAndInterest = monthlyPrincipalAndInterest(loanAmount, input.annualRatePct, input.termYears);
  const propertyTax = (homePrice * assumptions.taxRatePct) / 100 / 12;
  const insurance = (homePrice * assumptions.insuranceRatePct) / 100 / 12;
  const pmi = downPaymentPct < PMI_DOWN_PAYMENT_THRESHOLD_PCT ? (loanAmount * assumptions.pmiRatePct) / 100 / 12 : 0;
  return {
    loanAmount,
    downPaymentPct,
    principalAndInterest,
    propertyTax,
    insurance,
    pmi,
    total: principalAndInterest + propertyTax + insurance + pmi,
  };
}

export interface AffordabilityInput {
  monthlyBudget: number;
  downPaymentPct: number;
  annualRatePct: number;
  termYears: number;
}

export interface AffordabilityResult {
  maxHomePrice: number;
  downPayment: number;
  loanAmount: number;
  breakdown: PaymentBreakdown;
}

/**
 * The most expensive home whose estimated total monthly payment stays within the budget.
 * With the down payment held at a fixed percentage every payment piece is proportional to the
 * price, so the answer is the budget divided by the payment on a $1 home.
 */
export function maxHomePrice(input: AffordabilityInput, assumptions: Assumptions = DEFAULT_ASSUMPTIONS): AffordabilityResult {
  const budget = Math.max(0, finite(input.monthlyBudget));
  const downPct = Math.min(100, Math.max(0, finite(input.downPaymentPct)));
  const perDollar = paymentBreakdown(
    { homePrice: 1, downPayment: downPct / 100, annualRatePct: input.annualRatePct, termYears: input.termYears },
    assumptions,
  ).total;
  const price = perDollar > 0 ? budget / perDollar : 0;
  const downPayment = (price * downPct) / 100;
  return {
    maxHomePrice: price,
    downPayment,
    loanAmount: price - downPayment,
    breakdown: paymentBreakdown(
      { homePrice: price, downPayment, annualRatePct: input.annualRatePct, termYears: input.termYears },
      assumptions,
    ),
  };
}
