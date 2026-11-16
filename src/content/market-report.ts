/**
 * Loan Officer Market Report: originated home loans by county, from public HMDA data.
 *
 * Source: CFPB / FFIEC HMDA Data Browser aggregations API
 * (https://ffiec.cfpb.gov/v2/data-browser-api/view/aggregations), originated loans only
 * (actions_taken=1), fetched 2026-11-16. Raw responses are kept in the project files under
 * ypnus/hmda/. Dollar sums are HMDA public loan amounts, which HMDA reports rounded to the
 * midpoint of a $10,000 band, so totals are close approximations, not exact sums.
 *
 * To add a year or a county: query the three aggregations below for that county and year,
 * add the numbers here, and run `npm test` (src/content/market-report.test.ts checks that
 * the loan-type counts add up to the county total).
 *
 * Loan type codes: 1 conventional, 2 FHA, 3 VA, 4 USDA (RHS/FSA).
 * Loan purpose codes: 1 home purchase, 2 home improvement, 31 refinance, 32 cash-out
 * refinance, 4 other purpose. Code 5 (not applicable) is not queried, so purposes can sum
 * to slightly less than the total.
 */

export interface CountSum {
  /** Number of originated loans. */
  count: number;
  /** Sum of loan amounts in dollars (HMDA public, banded). */
  sum: number;
}

export interface CountyYear {
  total: CountSum;
  loanTypes: { conventional: CountSum; fha: CountSum; va: CountSum; usda: CountSum };
  purposes: { purchase: CountSum; homeImprovement: CountSum; refinance: CountSum; cashOutRefinance: CountSum; other: CountSum };
}

export interface ReportCounty {
  /** URL slug, e.g. "fresno-county-ca". */
  slug: string;
  /** Five-digit FIPS code. */
  fips: string;
  name: string;
  stateCode: string;
  /** Larger cities in the county, for copy only. */
  cities: readonly string[];
  years: Record<ReportYear, CountyYear>;
}

export const REPORT_YEARS = [2023, 2024] as const;
export type ReportYear = (typeof REPORT_YEARS)[number];
export const LATEST_YEAR: ReportYear = 2024;
export const PREVIOUS_YEAR: ReportYear = 2023;
export const REPORT_REGION = "California's Central Valley";
export const DATA_FETCHED_ON = "2026-11-16";
export const HMDA_SOURCE_URL = "https://ffiec.cfpb.gov/data-browser/";

const cs = (count: number, sum: number): CountSum => ({ count, sum });

export const REPORT_COUNTIES: readonly ReportCounty[] = [
  {
    slug: "fresno-county-ca",
    fips: "06019",
    name: "Fresno County",
    stateCode: "CA",
    cities: ["Fresno", "Clovis", "Reedley", "Sanger"],
    years: {
      2024: {
        total: cs(13027, 4.030225e9),
        loanTypes: { conventional: cs(9728, 2.79369e9), fha: cs(2580, 9.256e8), va: cs(708, 3.0745e8), usda: cs(11, 3485000) },
        purposes: {
          purchase: cs(7623, 2.839435e9),
          homeImprovement: cs(1087, 1.13645e8),
          refinance: cs(1015, 4.75535e8),
          cashOutRefinance: cs(1992, 4.7434e8),
          other: cs(1295, 1.24065e8),
        },
      },
      2023: {
        total: cs(11015, 3.373965e9),
        loanTypes: { conventional: cs(8423, 2.464145e9), fha: cs(2122, 7.1886e8), va: cs(451, 1.83795e8), usda: cs(19, 7165000) },
        purposes: {
          purchase: cs(6766, 2.46903e9),
          homeImprovement: cs(1046, 1.0022e8),
          refinance: cs(487, 2.42025e8),
          cashOutRefinance: cs(1642, 4.4955e8),
          other: cs(1066, 1.0488e8),
        },
      },
    },
  },
  {
    slug: "kern-county-ca",
    fips: "06029",
    name: "Kern County",
    stateCode: "CA",
    cities: ["Bakersfield", "Delano", "Tehachapi"],
    years: {
      2024: {
        total: cs(13663, 3.893655e9),
        loanTypes: { conventional: cs(8882, 2.21805e9), fha: cs(3671, 1.250005e9), va: cs(1088, 4.1949e8), usda: cs(22, 6110000) },
        purposes: {
          purchase: cs(8298, 2.83784e9),
          homeImprovement: cs(766, 6.62e7),
          refinance: cs(1100, 3.9517e8),
          cashOutRefinance: cs(2103, 4.78375e8),
          other: cs(1385, 1.13485e8),
        },
      },
      2023: {
        total: cs(11831, 3.164005e9),
        loanTypes: { conventional: cs(7875, 1.861655e9), fha: cs(3090, 9.8937e8), va: cs(831, 3.00375e8), usda: cs(35, 1.2605e7) },
        purposes: {
          purchase: cs(7725, 2.470055e9),
          homeImprovement: cs(776, 6.531e7),
          refinance: cs(432, 1.6826e8),
          cashOutRefinance: cs(1726, 3.6752e8),
          other: cs(1166, 9.199e7),
        },
      },
    },
  },
  {
    slug: "kings-county-ca",
    fips: "06031",
    name: "Kings County",
    stateCode: "CA",
    cities: ["Hanford", "Lemoore", "Corcoran"],
    years: {
      2024: {
        total: cs(2232, 6.3568e8),
        loanTypes: { conventional: cs(1132, 2.3705e8), fha: cs(601, 2.03445e8), va: cs(489, 1.92405e8), usda: cs(10, 2780000) },
        purposes: {
          purchase: cs(1373, 4.56795e8),
          homeImprovement: cs(103, 9445000),
          refinance: cs(261, 8.7975e7),
          cashOutRefinance: cs(300, 6.551e7),
          other: cs(194, 1.579e7),
        },
      },
      2023: {
        total: cs(1565, 4.44885e8),
        loanTypes: { conventional: cs(849, 1.98795e8), fha: cs(381, 1.20075e8), va: cs(328, 1.2419e8), usda: cs(7, 1825000) },
        purposes: {
          purchase: cs(995, 3.36085e8),
          homeImprovement: cs(92, 9130000),
          refinance: cs(84, 3.088e7),
          cashOutRefinance: cs(263, 5.8035e7),
          other: cs(131, 1.0755e7),
        },
      },
    },
  },
  {
    slug: "madera-county-ca",
    fips: "06039",
    name: "Madera County",
    stateCode: "CA",
    cities: ["Madera", "Chowchilla", "Oakhurst"],
    years: {
      2024: {
        total: cs(3121, 9.94835e8),
        loanTypes: { conventional: cs(2118, 5.9984e8), fha: cs(774, 2.9255e8), va: cs(225, 1.01075e8), usda: cs(4, 1370000) },
        purposes: {
          purchase: cs(2084, 7.8531e8),
          homeImprovement: cs(187, 1.7725e7),
          refinance: cs(222, 7.806e7),
          cashOutRefinance: cs(373, 8.8185e7),
          other: cs(252, 2.379e7),
        },
      },
      2023: {
        total: cs(2353, 7.41435e8),
        loanTypes: { conventional: cs(1616, 4.6881e8), fha: cs(588, 2.0956e8), va: cs(143, 6.2085e7), usda: cs(6, 980000) },
        purposes: {
          purchase: cs(1606, 5.9192e8),
          homeImprovement: cs(182, 1.596e7),
          refinance: cs(78, 4.428e7),
          cashOutRefinance: cs(316, 7.23e7),
          other: cs(168, 1.653e7),
        },
      },
    },
  },
  {
    slug: "merced-county-ca",
    fips: "06047",
    name: "Merced County",
    stateCode: "CA",
    cities: ["Merced", "Los Banos", "Atwater"],
    years: {
      2024: {
        total: cs(3458, 1.00237e9),
        loanTypes: { conventional: cs(2399, 6.02085e8), fha: cs(887, 3.30665e8), va: cs(164, 6.699e7), usda: cs(8, 2630000) },
        purposes: {
          purchase: cs(2077, 7.37835e8),
          homeImprovement: cs(234, 2.238e7),
          refinance: cs(276, 8.353e7),
          cashOutRefinance: cs(546, 1.3041e8),
          other: cs(323, 2.7805e7),
        },
      },
      2023: {
        total: cs(2931, 8.55695e8),
        loanTypes: { conventional: cs(2042, 5.3605e8), fha: cs(759, 2.70225e8), va: cs(120, 4.635e7), usda: cs(10, 3070000) },
        purposes: {
          purchase: cs(1884, 6.6193e8),
          homeImprovement: cs(222, 2.186e7),
          refinance: cs(116, 4.301e7),
          cashOutRefinance: cs(453, 1.02625e8),
          other: cs(253, 2.5735e7),
        },
      },
    },
  },
  {
    slug: "san-joaquin-county-ca",
    fips: "06077",
    name: "San Joaquin County",
    stateCode: "CA",
    cities: ["Stockton", "Tracy", "Manteca", "Lodi"],
    years: {
      2024: {
        total: cs(13044, 5.10747e9),
        loanTypes: { conventional: cs(10509, 3.930775e9), fha: cs(2016, 9.1599e8), va: cs(512, 2.6034e8), usda: cs(7, 365000) },
        purposes: {
          purchase: cs(7602, 3.71521e9),
          homeImprovement: cs(998, 1.2182e8),
          refinance: cs(1322, 6.6653e8),
          cashOutRefinance: cs(1782, 4.5781e8),
          other: cs(1338, 1.4483e8),
        },
      },
      2023: {
        total: cs(10509, 4.165995e9),
        loanTypes: { conventional: cs(8366, 3.20508e9), fha: cs(1766, 7.7926e8), va: cs(369, 1.81415e8), usda: cs(8, 240000) },
        purposes: {
          purchase: cs(6871, 3.316675e9),
          homeImprovement: cs(939, 1.06815e8),
          refinance: cs(490, 3.0035e8),
          cashOutRefinance: cs(1293, 3.40525e8),
          other: cs(916, 1.0163e8),
        },
      },
    },
  },
  {
    slug: "stanislaus-county-ca",
    fips: "06099",
    name: "Stanislaus County",
    stateCode: "CA",
    cities: ["Modesto", "Turlock", "Ceres", "Oakdale"],
    years: {
      2024: {
        total: cs(7280, 2.38089e9),
        loanTypes: { conventional: cs(5386, 1.58407e9), fha: cs(1514, 6.1769e8), va: cs(375, 1.77655e8), usda: cs(5, 1475000) },
        purposes: {
          purchase: cs(4117, 1.644735e9),
          homeImprovement: cs(797, 7.7585e7),
          refinance: cs(586, 3.1408e8),
          cashOutRefinance: cs(1233, 2.87815e8),
          other: cs(542, 5.544e7),
        },
      },
      2023: {
        total: cs(6077, 1.972475e9),
        loanTypes: { conventional: cs(4575, 1.371535e9), fha: cs(1264, 4.913e8), va: cs(237, 1.09275e8), usda: cs(1, 365000) },
        purposes: {
          purchase: cs(3692, 1.46676e9),
          homeImprovement: cs(549, 7.0055e7),
          refinance: cs(304, 1.218e8),
          cashOutRefinance: cs(927, 2.54155e8),
          other: cs(605, 5.9705e7),
        },
      },
    },
  },
  {
    slug: "tulare-county-ca",
    fips: "06107",
    name: "Tulare County",
    stateCode: "CA",
    cities: ["Visalia", "Tulare", "Porterville", "Dinuba"],
    years: {
      2024: {
        total: cs(5725, 1.552765e9),
        loanTypes: { conventional: cs(3795, 8.81275e8), fha: cs(1567, 5.30545e8), va: cs(357, 1.39315e8), usda: cs(6, 1630000) },
        purposes: {
          purchase: cs(3307, 1.073055e9),
          homeImprovement: cs(359, 3.1945e7),
          refinance: cs(518, 1.8332e8),
          cashOutRefinance: cs(993, 2.16675e8),
          other: cs(531, 4.3625e7),
        },
      },
      2023: {
        total: cs(4407, 1.172855e9),
        loanTypes: { conventional: cs(3031, 7.23235e8), fha: cs(1127, 3.56915e8), va: cs(243, 9.0975e7), usda: cs(6, 1730000) },
        purposes: {
          purchase: cs(2663, 8.54585e8),
          homeImprovement: cs(357, 3.3715e7),
          refinance: cs(198, 4.384e7),
          cashOutRefinance: cs(768, 1.6566e8),
          other: cs(420, 3.635e7),
        },
      },
    },
  },
];

export function getReportCounty(slug: string): ReportCounty | undefined {
  return REPORT_COUNTIES.find((c) => c.slug === slug);
}

/** Percent change from `before` to `after`, rounded to one decimal. Null when there is no base. */
export function percentChange(before: number, after: number): number | null {
  if (!before) return null;
  return Math.round(((after - before) / before) * 1000) / 10;
}

/** Share of `part` in `whole` as a percent with one decimal. */
export function sharePercent(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/** Average loan amount in dollars, rounded to the nearest $1,000. */
export function averageLoan(cs: CountSum): number {
  if (!cs.count) return 0;
  return Math.round(cs.sum / cs.count / 1000) * 1000;
}

const usdCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const intFmt = new Intl.NumberFormat("en-US");

/** "$4B", "$635.7M" */
export function formatDollarsCompact(n: number): string {
  return usdCompact.format(n);
}
/** "$309,000" */
export function formatDollars(n: number): string {
  return usdWhole.format(n);
}
/** "13,027" */
export function formatCount(n: number): string {
  return intFmt.format(n);
}
/** "+18.3%", "-2.1%", "n/a" */
export function formatChange(pct: number | null): string {
  if (pct === null) return "n/a";
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

/** Sum of every report county for one year. */
export function regionTotals(year: ReportYear): CountyYear {
  const zero = (): CountSum => ({ count: 0, sum: 0 });
  const acc: CountyYear = {
    total: zero(),
    loanTypes: { conventional: zero(), fha: zero(), va: zero(), usda: zero() },
    purposes: { purchase: zero(), homeImprovement: zero(), refinance: zero(), cashOutRefinance: zero(), other: zero() },
  };
  const add = (into: CountSum, from: CountSum) => {
    into.count += from.count;
    into.sum += from.sum;
  };
  for (const county of REPORT_COUNTIES) {
    const y = county.years[year];
    add(acc.total, y.total);
    for (const k of Object.keys(acc.loanTypes) as Array<keyof CountyYear["loanTypes"]>) add(acc.loanTypes[k], y.loanTypes[k]);
    for (const k of Object.keys(acc.purposes) as Array<keyof CountyYear["purposes"]>) add(acc.purposes[k], y.purposes[k]);
  }
  return acc;
}

/**
 * Plain-English takeaways for loan officers, computed only from the county's own numbers.
 * Kept factual: each line states a number from HMDA and nothing about rates or outcomes.
 */
export function countyTakeaways(county: ReportCounty): string[] {
  const now = county.years[LATEST_YEAR];
  const before = county.years[PREVIOUS_YEAR];
  const lines: string[] = [];

  const totalChange = percentChange(before.total.count, now.total.count);
  if (totalChange !== null) {
    lines.push(
      `${formatCount(now.total.count)} home loans were originated in ${county.name} in ${LATEST_YEAR}, ${
        totalChange >= 0 ? "up" : "down"
      } ${Math.abs(totalChange)}% from ${formatCount(before.total.count)} in ${PREVIOUS_YEAR}.`,
    );
  }

  const purchaseShare = sharePercent(now.purposes.purchase.count, now.total.count);
  lines.push(`Home purchases made up ${purchaseShare}% of originated loans in ${LATEST_YEAR}.`);

  const govCount = now.loanTypes.fha.count + now.loanTypes.va.count + now.loanTypes.usda.count;
  lines.push(
    `FHA, VA and USDA loans together were ${sharePercent(govCount, now.total.count)}% of originations (FHA ${sharePercent(
      now.loanTypes.fha.count,
      now.total.count,
    )}%, VA ${sharePercent(now.loanTypes.va.count, now.total.count)}%).`,
  );

  const refiNow = now.purposes.refinance.count + now.purposes.cashOutRefinance.count;
  const refiBefore = before.purposes.refinance.count + before.purposes.cashOutRefinance.count;
  const refiChange = percentChange(refiBefore, refiNow);
  if (refiChange !== null) {
    lines.push(
      `Refinances, including cash-out, ${refiChange >= 0 ? "rose" : "fell"} ${Math.abs(refiChange)}% to ${formatCount(refiNow)} loans.`,
    );
  }

  lines.push(`The average originated purchase loan was about ${formatDollars(averageLoan(now.purposes.purchase))}.`);
  return lines;
}
