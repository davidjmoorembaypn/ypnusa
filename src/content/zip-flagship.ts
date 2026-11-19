/**
 * The capped set of ZIP code pages that may be indexed without a paying loan officer, and the
 * county facts shown on them.
 *
 * DO NOT grow this into a bulk list. The sitemap warning stands: tens of thousands of thin ZIP
 * pages put this site in Google's "Crawled - currently not indexed" queue once already. A ZIP code
 * page is indexable only if it is on this list, has a hand-written profile, or is actively claimed
 * (see src/lib/zip-index.ts). Add a ZIP code here only with real, checked local content.
 */

export type CentralValleyCounty = "Fresno County" | "Tulare County" | "Kings County" | "Madera County";

export interface FlagshipZip {
  zip: string;
  city: string;
  county: CentralValleyCounty;
}

/** 15 flagship Central Valley ZIP codes. */
export const FLAGSHIP_ZIPS: readonly FlagshipZip[] = [
  { zip: "93618", city: "Dinuba", county: "Tulare County" },
  { zip: "93654", city: "Reedley", county: "Fresno County" },
  { zip: "93631", city: "Kingsburg", county: "Fresno County" },
  { zip: "93662", city: "Selma", county: "Fresno County" },
  { zip: "93611", city: "Clovis", county: "Fresno County" },
  { zip: "93619", city: "Clovis", county: "Fresno County" },
  { zip: "93711", city: "Fresno", county: "Fresno County" },
  { zip: "93720", city: "Fresno", county: "Fresno County" },
  { zip: "93722", city: "Fresno", county: "Fresno County" },
  { zip: "93277", city: "Visalia", county: "Tulare County" },
  { zip: "93291", city: "Visalia", county: "Tulare County" },
  { zip: "93292", city: "Visalia", county: "Tulare County" },
  { zip: "93230", city: "Hanford", county: "Kings County" },
  { zip: "93274", city: "Tulare", county: "Tulare County" },
  { zip: "93637", city: "Madera", county: "Madera County" },
];

const BY_ZIP = new Map(FLAGSHIP_ZIPS.map((z) => [z.zip, z]));

export function flagshipZip(zip: string): FlagshipZip | undefined {
  return BY_ZIP.get(zip);
}

/**
 * 2026 loan limits for a one-unit home in Fresno, Tulare, Kings and Madera counties.
 *
 * - Conforming: $832,750. Checked on 2026-11-19 against FHFA's 2026 county file
 *   (fullcountyloanlimitlist2026_hera-based_final_flat.csv), which lists all four counties at the
 *   national baseline.
 * - FHA: $541,287, the FHA "floor", which HUD sets at 65% of the conforming limit
 *   (0.65 x $832,750 = $541,287.50). All four counties are floor counties. This figure follows from
 *   that rule; confirm it on HUD's lookup before relying on it.
 *
 * Update BOTH numbers and the year together when FHFA and HUD publish the next year's limits
 * (usually late November), and never show them for a county that is not listed above: high-cost
 * counties have higher limits.
 */
export const LOAN_LIMITS = {
  year: 2026,
  conformingOneUnit: 832_750,
  fhaFloorOneUnit: 541_287,
  conformingSource: { name: "FHFA conforming loan limit values", url: "https://www.fhfa.gov/data/conforming-loan-limit" },
  fhaSource: { name: "HUD FHA mortgage limits lookup", url: "https://entp.hud.gov/idapp/html/hicostlook.cfm" },
  checkedOn: "2026-11-19",
} as const;

/**
 * Property tax context for the four counties. California's base rate is 1% of assessed value
 * (Proposition 13); voter-approved bonds and special assessments are added by parcel. The range is
 * an estimate for a newly purchased home, not a quote for any property.
 */
export const PROPERTY_TAX_CONTEXT = {
  baseRatePct: 1,
  typicalLowPct: 1.1,
  typicalHighPct: 1.18,
} as const;

/** CalHFA program overviews. Terms, income limits and funding change, so the copy stays general. */
export const CALHFA_PROGRAMS = {
  myHome: { name: "CalHFA MyHome Assistance Program", url: "https://www.calhfa.ca.gov/homebuyer/programs/myhome.htm" },
  dreamForAll: { name: "California Dream For All Shared Appreciation Loan", url: "https://www.calhfa.ca.gov/dream/" },
} as const;
