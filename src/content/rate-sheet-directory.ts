/**
 * Directory of where loan officers get rate and pricing information, by loan type.
 *
 * This lists SOURCES, not rates. Public benchmarks show where the market is; only a lender's own
 * rate sheet and lock desk show pricing a loan officer can actually lock. Never put a rate, a
 * lender's pricing or a "best rate" claim in this file. The "updated" label on each entry is how
 * often the SOURCE publishes, not a date YPN USA refreshed anything.
 *
 * To add a source: give it a url that returns 200 (or null for lender-specific sheets), say how
 * often it updates, and run `npm test`. Re-check the links and bump RATE_SHEET_LINKS_CHECKED_ON.
 */

export const RATE_SHEET_LOAN_TYPES = ["Conventional", "FHA", "VA", "Jumbo", "DSCR"] as const;
export type RateSheetLoanType = (typeof RATE_SHEET_LOAN_TYPES)[number];

export type RateSheetSourceKind = "Public benchmark" | "Agency guide" | "Your lender";

export interface RateSheetSource {
  id: string;
  name: string;
  publisher: string;
  loanTypes: readonly RateSheetLoanType[];
  kind: RateSheetSourceKind;
  /** null for lender-specific sheets you get from your own wholesale lender. */
  url: string | null;
  whatItShows: string;
  /** How often the source itself updates. */
  updates: string;
}

export const RATE_SHEET_LINKS_CHECKED_ON = "2026-11-19";

export const RATE_SHEET_SOURCES: readonly RateSheetSource[] = [
  {
    id: "freddie-pmms",
    name: "Primary Mortgage Market Survey (PMMS)",
    publisher: "Freddie Mac",
    loanTypes: ["Conventional"],
    kind: "Public benchmark",
    url: "https://www.freddiemac.com/pmms",
    whatItShows: "Weekly average 30-year and 15-year fixed rates from a lender survey. A market reference, not what any one borrower will be offered.",
    updates: "Weekly",
  },
  {
    id: "mnd-index",
    name: "Mortgage rate index",
    publisher: "Mortgage News Daily",
    loanTypes: ["Conventional", "FHA", "VA", "Jumbo"],
    kind: "Public benchmark",
    url: "https://www.mortgagenewsdaily.com/mortgage-rates",
    whatItShows: "A daily rate index across several loan types. Useful for a quick read on direction before you pull your lender's sheet.",
    updates: "Daily",
  },
  {
    id: "fannie-selling-guide",
    name: "Selling Guide",
    publisher: "Fannie Mae",
    loanTypes: ["Conventional"],
    kind: "Agency guide",
    url: "https://selling-guide.fanniemae.com/",
    whatItShows: "Eligibility, documentation and pricing-adjustment rules for conforming loans sold to Fannie Mae.",
    updates: "As announced by Fannie Mae",
  },
  {
    id: "freddie-guide",
    name: "Seller/Servicer Guide",
    publisher: "Freddie Mac",
    loanTypes: ["Conventional"],
    kind: "Agency guide",
    url: "https://guide.freddiemac.com/",
    whatItShows: "Eligibility, documentation and pricing-adjustment rules for conforming loans sold to Freddie Mac.",
    updates: "As announced by Freddie Mac",
  },
  {
    id: "fhfa-limits",
    name: "Conforming loan limits",
    publisher: "FHFA",
    loanTypes: ["Conventional", "Jumbo"],
    kind: "Agency guide",
    url: "https://www.fhfa.gov/data/conforming-loan-limit",
    whatItShows: "The loan amount above which a conventional loan is jumbo, by county. Check it before you quote a loan type.",
    updates: "Yearly",
  },
  {
    id: "hud-4000-1",
    name: "Single Family Housing Policy Handbook (4000.1)",
    publisher: "HUD",
    loanTypes: ["FHA"],
    kind: "Agency guide",
    url: "https://www.hud.gov/program_offices/housing/sfh/handbook_4000-1",
    whatItShows: "FHA underwriting and eligibility rules, including mortgage insurance and property requirements.",
    updates: "As announced by HUD",
  },
  {
    id: "va-lenders",
    name: "VA home loan guidance for lenders",
    publisher: "U.S. Department of Veterans Affairs",
    loanTypes: ["VA"],
    kind: "Agency guide",
    url: "https://www.benefits.va.gov/homeloans/lenders.asp",
    whatItShows: "VA lender requirements, circulars and the Lender's Handbook, including funding fee and entitlement rules.",
    updates: "As announced by VA",
  },
  {
    id: "lender-sheet-agency",
    name: "Your wholesale lender's rate sheet and lock desk",
    publisher: "Each lender you broker with",
    loanTypes: ["Conventional", "FHA", "VA"],
    kind: "Your lender",
    url: null,
    whatItShows:
      "The only source of pricing you can actually lock. Ask each lender for its lock policy, extension fees and float-down terms, and when its sheet reprices.",
    updates: "Set by the lender; can reprice during the day",
  },
  {
    id: "lender-sheet-jumbo",
    name: "Jumbo lender rate sheets",
    publisher: "Each jumbo lender you broker with",
    loanTypes: ["Jumbo"],
    kind: "Your lender",
    url: null,
    whatItShows: "Jumbo pricing and overlays differ widely by lender, so there is no single public benchmark. Compare sheets for your borrower's loan size, credit and reserves.",
    updates: "Set by the lender",
  },
  {
    id: "lender-sheet-dscr",
    name: "DSCR and non-QM lender rate sheets",
    publisher: "Each non-QM lender you broker with",
    loanTypes: ["DSCR"],
    kind: "Your lender",
    url: null,
    whatItShows:
      "DSCR pricing depends on the property's DSCR, LTV, credit score, property type and any prepayment penalty. There is no public benchmark, so get the pricing matrix from each lender.",
    updates: "Set by the lender",
  },
];

export function sourcesForLoanType(type: RateSheetLoanType | "All"): readonly RateSheetSource[] {
  return type === "All" ? RATE_SHEET_SOURCES : RATE_SHEET_SOURCES.filter((s) => s.loanTypes.includes(type));
}
