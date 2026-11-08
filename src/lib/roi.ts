import {
  CURRENT_PAID_TIER_IDS,
  PREPAID_5Y,
  PREPAID_5Y_YEARS,
  PUBLIC_MONTHLY_PRICE_CENTS,
  getPricingTier,
  type CurrentPaidTierId,
} from "@/lib/pricing";

/**
 * Math behind the /pricing ROI calculator. Pure arithmetic on numbers the visitor types in
 * plus our own prices — no benchmarks or outcome statistics are assumed anywhere.
 */

export interface RoiPlanRow {
  tierId: CurrentPaidTierId;
  name: string;
  /** One year on the monthly plan (12 × the monthly price), in cents. */
  monthlyPlanYearlyCents: number;
  /** The 5-year prepaid price spread over 5 years, in cents. */
  prepaidYearlyCents: number;
  /** How many times one year's extra commission covers the monthly plan's yearly cost. */
  monthlyCoverage: number;
  /** How many times one year's extra commission covers the 5-year plan's cost per year. */
  prepaidCoverage: number;
}

export interface RoiResult {
  extraCommissionYearlyCents: number;
  rows: RoiPlanRow[];
}

/** Parses a typed dollar amount like "3,000", "$3000" or "2500.50"; null if it isn't one. */
export function parseDollarInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Parses the "extra loans per year" field: blank means the default of 1; negatives are invalid. */
export function parseLoanCountInput(raw: string, fallback = 1): number | null {
  const cleaned = raw.trim();
  if (!cleaned) return fallback;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Yearly cost of each current plan, with no visitor input — the calculator's static rows. */
export function planYearlyCosts(): Array<Pick<RoiPlanRow, "tierId" | "name" | "monthlyPlanYearlyCents" | "prepaidYearlyCents">> {
  return CURRENT_PAID_TIER_IDS.map((tierId) => ({
    tierId,
    name: getPricingTier(tierId).name,
    monthlyPlanYearlyCents: PUBLIC_MONTHLY_PRICE_CENTS[tierId] * 12,
    prepaidYearlyCents: Math.round(PREPAID_5Y[tierId].priceCents / PREPAID_5Y_YEARS),
  }));
}

/**
 * Returns null until the visitor has entered a positive commission and a valid loan count,
 * so the UI shows costs only rather than a misleading "0×".
 */
export function computeRoi(commissionDollars: number | null, extraLoansPerYear: number | null): RoiResult | null {
  if (commissionDollars === null || extraLoansPerYear === null) return null;
  if (!(commissionDollars > 0) || !(extraLoansPerYear > 0)) return null;
  const extraCommissionYearlyCents = Math.round(commissionDollars * 100 * extraLoansPerYear);
  return {
    extraCommissionYearlyCents,
    rows: planYearlyCosts().map((row) => ({
      ...row,
      monthlyCoverage: extraCommissionYearlyCents / row.monthlyPlanYearlyCents,
      prepaidCoverage: extraCommissionYearlyCents / row.prepaidYearlyCents,
    })),
  };
}

/** "2.5×", "12×" — one decimal under 10, whole numbers above, never rounds a shortfall up to 1. */
export function formatCoverage(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0×";
  if (ratio >= 10) return `${Math.floor(ratio)}×`;
  return `${(Math.floor(ratio * 10) / 10).toFixed(1)}×`;
}

/* ------------------------------------------------------------------------------------------
 * /roi: "How many extra loans pay for YPN?" — loans per year needed to cover a plan, from the
 * visitor's own loan size and compensation. Same rule as above: only their numbers and our
 * prices go in.
 * ---------------------------------------------------------------------------------------- */

export type CompensationMode = "bps" | "flat";

/** Plan choices on /roi: each current plan billed monthly, or the 5-year prepaid price per year. */
export interface RoiPlanOption {
  id: string;
  label: string;
  yearlyCents: number;
}

export function roiPlanOptions(): RoiPlanOption[] {
  return planYearlyCosts().flatMap((row) => [
    { id: `${row.tierId}-monthly`, label: `${row.name}, monthly`, yearlyCents: row.monthlyPlanYearlyCents },
    { id: `${row.tierId}-5y`, label: `${row.name}, 5-year prepaid`, yearlyCents: row.prepaidYearlyCents },
  ]);
}

/** Parses a typed number like "100", "87.5" or "1,000"; null when it isn't a non-negative number. */
export function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Compensation for one closed loan, in cents. Basis points: loan amount × bps ÷ 10,000
 * (100 bps = 1%). Flat: the per-loan amount as typed. Null until the inputs make a positive amount.
 */
export function compensationPerLoanCents(input: {
  mode: CompensationMode;
  loanAmountDollars: number | null;
  bps: number | null;
  flatDollars: number | null;
}): number | null {
  if (input.mode === "flat") {
    if (input.flatDollars === null || !(input.flatDollars > 0)) return null;
    return Math.round(input.flatDollars * 100);
  }
  if (input.loanAmountDollars === null || input.bps === null) return null;
  if (!(input.loanAmountDollars > 0) || !(input.bps > 0)) return null;
  return Math.round((input.loanAmountDollars * 100 * input.bps) / 10_000);
}

export interface LoansToCover {
  /** Exact ratio: plan cost per year ÷ compensation per loan. */
  exact: number;
  /** Whole loans needed (you can't close part of a loan), rounded up. */
  wholeLoans: number;
}

/** Loans needed per year to cover a plan's yearly cost; null without a positive compensation. */
export function loansToCoverPlan(compPerLoanCents: number | null, planYearlyCents: number): LoansToCover | null {
  if (compPerLoanCents === null || !(compPerLoanCents > 0) || !(planYearlyCents > 0)) return null;
  const exact = planYearlyCents / compPerLoanCents;
  // Guard against float noise (e.g. 2.0000000001) before rounding up.
  const wholeLoans = Math.max(1, Math.ceil(Math.round(exact * 1e6) / 1e6));
  return { exact, wholeLoans };
}
