import { FLAGSHIP_ZIPS } from "@/content/zip-flagship";
import { zipPlace } from "@/lib/geo/zip-geo";
import { paidLedgerClaimedZips } from "@/lib/territory";
import { DEMAND_ESTIMATE_LABEL, DEMAND_METHODOLOGY, DEMAND_SOURCE, DEMAND_WINDOW_DAYS, allZipDemand, estimateZipDemand } from "@/lib/zip-demand";

/**
 * Aggregates for the Quarterly Mortgage Demand Report (/reports/quarterly-mortgage-demand).
 *
 * Everything is computed from two sources and nothing else: the Census-based 60-day demand
 * estimates (src/lib/zip-demand.ts) and this app's own territory ledger. The demand figures
 * describe past moves measured by the Census, so the report states what was measured and never
 * forecasts.
 */

export const REPORT_PATH = "/reports/quarterly-mortgage-demand";
/** Bump each quarter when the availability snapshot is refreshed. */
export const REPORT_EDITION = "Q4 2026";
export const REPORT_PUBLISHED = "2026-11-19";

export interface ReportZipRow {
  rank: number;
  zip: string;
  city: string;
  state: string;
  /** 60-day estimates, in households. */
  buyers: number;
  movers_in: number;
  total: number;
  households: number;
}

export interface FlagshipRow extends Omit<ReportZipRow, "households"> {
  county: string;
  status: "open" | "claimed";
}

export interface DemandReport {
  edition: string;
  windowDays: number;
  nationalTop: ReportZipRow[];
  flagship: FlagshipRow[];
  availability: { flagshipTotal: number; flagshipOpen: number; flagshipClaimed: number };
  /** National 60-day totals across every ZIP code with survey data. */
  summary: {
    zipCodesCovered: number;
    buyers: number;
    sellers: number;
    movers_in: number;
    total: number;
    /** Share of households moving in that moved into a home they own. */
    buyerSharePct: number;
    medianTotalPerZip: number;
  };
  label: string;
  source: string;
  methodology: string;
}

const TOP_N = 15;

export function buildDemandReport(claimed: ReadonlySet<string> = paidLedgerClaimedZips()): DemandReport {
  const all = allZipDemand();
  // Ranked by buyer households (move-ins to owner-occupied homes), the figure that matters for mortgages.
  const sorted = [...all].sort((a, b) => b.buyers - a.buyers || b.total - a.total || a.zip.localeCompare(b.zip));

  const nationalTop: ReportZipRow[] = sorted.slice(0, TOP_N).map((row, i) => {
    const place = zipPlace(row.zip);
    return { rank: i + 1, zip: row.zip, city: place?.city ?? "", state: place?.state ?? "", buyers: row.buyers, movers_in: row.movers_in, total: row.total, households: row.households };
  });

  const flagship: FlagshipRow[] = FLAGSHIP_ZIPS.map((z) => {
    const d = estimateZipDemand(z.zip);
    return {
      zip: z.zip,
      city: z.city,
      state: "CA",
      county: z.county,
      buyers: d?.buyers ?? 0,
      movers_in: d?.movers_in ?? 0,
      total: d?.total ?? 0,
      status: claimed.has(z.zip) ? ("claimed" as const) : ("open" as const),
    };
  })
    .sort((a, b) => b.buyers - a.buyers || b.total - a.total || a.zip.localeCompare(b.zip))
    .map((row, i) => ({ rank: i + 1, ...row }));

  const buyers = all.reduce((sum, r) => sum + r.buyers, 0);
  const sellers = all.reduce((sum, r) => sum + r.sellers, 0);
  const moversIn = all.reduce((sum, r) => sum + r.movers_in, 0);
  const totals = all.map((r) => r.total).sort((a, b) => a - b);
  const mid = Math.floor(totals.length / 2);
  const median = totals.length === 0 ? 0 : totals.length % 2 ? totals[mid] : Math.round((totals[mid - 1] + totals[mid]) / 2);
  const flagshipClaimed = flagship.filter((f) => f.status === "claimed").length;

  return {
    edition: REPORT_EDITION,
    windowDays: DEMAND_WINDOW_DAYS,
    nationalTop,
    flagship,
    availability: { flagshipTotal: flagship.length, flagshipOpen: flagship.length - flagshipClaimed, flagshipClaimed },
    summary: {
      zipCodesCovered: all.length,
      buyers,
      sellers,
      movers_in: moversIn,
      total: buyers + sellers + moversIn,
      buyerSharePct: buyers + moversIn > 0 ? Math.round((buyers / (buyers + moversIn)) * 100) : 0,
      medianTotalPerZip: median,
    },
    label: DEMAND_ESTIMATE_LABEL,
    source: DEMAND_SOURCE,
    methodology: DEMAND_METHODOLOGY,
  };
}

/** Plain-text and HTML citations a journalist or blogger can paste. */
export function reportCitations(origin: string): { text: string; html: string } {
  const url = `${origin}${REPORT_PATH}`;
  const title = `Quarterly Mortgage Demand Report, ${REPORT_EDITION}`;
  return {
    text: `YPN USA. "${title}." Analysis of U.S. Census Bureau American Community Survey 2019-2023 5-year estimates. ${url}`,
    html: `<a href="${url}">${title}</a>, YPN USA analysis of U.S. Census Bureau American Community Survey data.`,
  };
}
