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
