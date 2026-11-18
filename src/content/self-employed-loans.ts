import type { ProgramContent } from "@/content/mortgage-programs";
import { LATEST_YEAR, PREVIOUS_YEAR, REPORT_COUNTIES, type ReportCounty } from "@/content/market-report";

/**
 * Borrower pages for self-employed buyers and real estate investors: bank statement loans,
 * DSCR loans, and one Central Valley page per county (Nov 2026).
 *
 * Who these pages are for: borrowers who already have a down payment and reserves but whose
 * tax returns understate their income, and investors buying rentals. Down payment assistance
 * is deliberately not covered (David, Nov 18 2026).
 *
 * Compliance: educational only. No rates, no payment estimates, no approval or loan
 * promises, no legal or tax advice. Program mechanics described here are general, widely
 * published non-QM practice; every specific figure on a county page comes from public HMDA
 * data in src/content/market-report.ts. Never write "Young Professional Networks": the brand
 * is YPN USA and the legal name is YPN Inc.
 *
 * Search demand behind the page set (OpenSEO, US, Nov 18 2026): "dscr loan" ~60,500/mo,
 * "dscr loan requirements" ~2,900, "bank statement loan" ~3,600 (CPC ~$50),
 * "self employed mortgage" ~880 (CPC ~$71), "dscr loan california" ~320. City-level searches
 * are too small to measure, so the county pages carry county data rather than chase city terms.
 */

export const SELF_EMPLOYED_HUB_PATH = "/self-employed-mortgage";
export const BANK_STATEMENT_PATH = "/mortgage-loans/bank-statement";
export const DSCR_PATH = "/mortgage-loans/dscr";
/** Bump when the copy on these pages actually changes (sitemap lastmod). */
export const SELF_EMPLOYED_LAST_MODIFIED = "2026-11-18";

export function selfEmployedCountyPath(county: Pick<ReportCounty, "slug">): string {
  return `${SELF_EMPLOYED_HUB_PATH}/${county.slug}`;
}

/** Lead-source tag for borrower intake, e.g. "self-employed-fresno-county-ca". */
export function selfEmployedFunnelSource(county?: Pick<ReportCounty, "slug">): string {
  return county ? `self-employed-${county.slug}` : "self-employed-ca";
}

export function selfEmployedIntakeHref(county?: Pick<ReportCounty, "slug">): string {
  return `/embed/intake?funnelSource=${encodeURIComponent(selfEmployedFunnelSource(county))}`;
}

export const BANK_STATEMENT_CONTENT: ProgramContent = {
  label: "Bank Statement Loans",
  summary:
    "Bank statement loans let self-employed borrowers apply for a mortgage using 12 or 24 months of bank deposits to show income, instead of tax returns.",
  intro:
    "A bank statement loan is a mortgage for self-employed borrowers whose tax returns don't show what the business really earns. Instead of averaging the net income on your returns, the lender reviews 12 or 24 months of personal or business bank statements and works out a qualifying income from your deposits. These are non-QM (non-qualified mortgage) loans from specialty lenders, so they usually ask for a larger down payment and more cash in reserve than a conventional loan. They suit buyers who already have money saved, not first-time buyers looking for assistance.",
  idealFor: [
    "Business owners, contractors and 1099 workers whose write-offs lower their taxable income",
    "Farmers, growers, truckers and other Central Valley owner-operators",
    "Buyers with a down payment and reserves already saved",
    "Self-employed borrowers who were turned down for a conventional loan on tax-return income",
  ],
  keyFeatures: [
    {
      title: "Income from deposits, not tax returns",
      body: "The lender reads 12 or 24 months of statements. Personal statements usually count eligible deposits; business statements usually have an expense factor applied, or a CPA-prepared profit and loss statement is used.",
    },
    {
      title: "Non-QM, but still underwritten",
      body: "Bank statement loans fall outside the federal Qualified Mortgage definition, but lenders must still make a reasonable, good-faith determination that you can repay under the federal Ability-to-Repay rule.",
    },
    {
      title: "More cash up front",
      body: "Expect a larger down payment and more reserves than a conventional loan. Exact requirements vary by lender, credit profile and property.",
    },
    {
      title: "Primary homes, second homes and rentals",
      body: "Many programs cover owner-occupied homes as well as second homes and investment property. Rental buyers often compare this with a DSCR loan.",
    },
  ],
  faqs: [
    {
      q: "What is a bank statement loan?",
      a: "A mortgage for self-employed borrowers that uses 12 or 24 months of bank deposits to show income instead of tax returns. It is a non-QM loan offered by specialty lenders.",
    },
    {
      q: "Who qualifies for a bank statement loan?",
      a: "Lenders generally look for about two years of self-employment, a consistent deposit history, acceptable credit, a down payment and cash reserves. Each lender sets its own guidelines, so a licensed loan officer has to review your file before anyone can say whether you qualify.",
    },
    {
      q: "Do I need tax returns for a bank statement loan?",
      a: "Most bank statement programs do not use tax returns to calculate income. Lenders may still ask for a business license, a CPA or tax preparer letter, or a profit and loss statement to confirm the business exists.",
    },
    {
      q: "Should I use personal or business bank statements?",
      a: "Either can work. Personal statements usually count eligible deposits, while business statements usually have an expense factor applied to the deposits. A loan officer can show you which method fits how your money moves.",
    },
    {
      q: "Are bank statement loans available in California?",
      a: "Yes. Several non-QM lenders offer bank statement programs in California, including the Central Valley. Terms differ from lender to lender, which is why comparing through a licensed loan officer matters.",
    },
    {
      q: "Is a bank statement loan the same as a DSCR loan?",
      a: "No. A bank statement loan qualifies you on your own deposits and can be used for a home you live in. A DSCR loan qualifies an investment property on its rent and is only for rentals.",
    },
  ],
};

/** Extra DSCR questions for the California audience ("dscr loan requirements" ~2,900/mo). */
export const DSCR_CALIFORNIA_FAQS: ProgramContent["faqs"] = [
  {
    q: "What are the usual DSCR loan requirements?",
    a: "Lenders typically look at the property's rent compared with its monthly principal, interest, taxes, insurance and any HOA dues, plus your credit, down payment and cash reserves. Each lender sets its own minimums.",
  },
  {
    q: "How is the DSCR ratio calculated?",
    a: "Divide the property's monthly rent by its monthly housing payment (principal, interest, taxes, insurance and HOA dues). A ratio of 1.0 means the rent covers the payment exactly. Rent usually comes from a lease or the appraiser's market rent estimate.",
  },
  {
    q: "Are DSCR loans available in California?",
    a: "Yes. Non-QM lenders offer DSCR loans across California, including Fresno, Bakersfield, Stockton, Modesto and Visalia. Because terms vary widely by lender, compare them with a licensed loan officer.",
  },
  {
    q: "Can I use a DSCR loan for a short-term rental?",
    a: "Some lenders allow it and use short-term rental income data to set the rent figure; others only accept long-term leases. Local rules on short-term rentals also apply.",
  },
];

export const SELF_EMPLOYED_HUB = {
  title: "Self-Employed and Investor Mortgages in California's Central Valley",
  metaTitle: "Self-Employed Mortgage Options in California's Central Valley",
  description:
    "How self-employed borrowers and real estate investors in the Central Valley buy homes with bank statement and DSCR loans instead of tax returns.",
  shortAnswer:
    "Self-employed borrowers in California can apply for a mortgage without using tax returns through two non-QM programs: a bank statement loan, which uses 12 or 24 months of deposits to show income, and a DSCR loan, which qualifies a rental property on its rent. Both usually need a larger down payment and more reserves than a conventional loan.",
  faqs: [
    {
      q: "Can I get a mortgage if I'm self-employed in California?",
      a: "Yes. Self-employed borrowers can use a conventional or FHA loan with two years of tax returns, or a non-QM option such as a bank statement loan when write-offs make taxable income look low.",
    },
    {
      q: "What is the difference between a bank statement loan and a DSCR loan?",
      a: "A bank statement loan qualifies you on your bank deposits and can be used for the home you live in. A DSCR loan qualifies an investment property on the rent it brings in and is only for rentals.",
    },
    {
      q: "Do non-QM loans cost more than conventional loans?",
      a: "Non-QM loans generally carry higher pricing than conventional loans because they sit outside agency guidelines. The difference depends on the lender, your credit, your down payment and the property, so ask a licensed loan officer for a written Loan Estimate to compare.",
    },
    {
      q: "Can I refinance into a bank statement or DSCR loan later?",
      a: "Yes. Both programs are commonly used for rate-and-term and cash-out refinances, subject to each lender's equity and seasoning rules.",
    },
  ],
};

/** County-specific copy. The numbers on each page come from REPORT_COUNTIES (HMDA), not from here. */
export interface SelfEmployedCountyAngle {
  /** Who is self-employed or investing locally, in one sentence. Kept general and plainly true. */
  borrowers: string;
  /** One sentence on the local investor angle. */
  investors: string;
}

export const SELF_EMPLOYED_COUNTY_ANGLES: Readonly<Record<string, SelfEmployedCountyAngle>> = {
  "fresno-county-ca": {
    borrowers:
      "Fresno County is one of California's largest farm counties, so many self-employed buyers here are growers, farm labor contractors, truckers, and owners of the shops, restaurants and trades businesses around Fresno and Clovis.",
    investors:
      "Investors buy single-family rentals and small multi-unit properties around Fresno State, Clovis and the older Fresno neighborhoods, where a DSCR loan lets the rent do the qualifying.",
  },
  "kern-county-ca": {
    borrowers:
      "Kern County's self-employed buyers include oil field and energy contractors, agricultural operators, truck owner-operators and Bakersfield small-business owners whose returns show heavy write-offs.",
    investors:
      "Bakersfield's rental market draws investors buying single-family homes and duplexes, which is where DSCR financing is most often used.",
  },
  "kings-county-ca": {
    borrowers:
      "Kings County's self-employed buyers are often farmers, dairy and ag service operators, and Hanford and Lemoore business owners.",
    investors:
      "Rentals near Naval Air Station Lemoore and in Hanford attract investors, and a DSCR loan qualifies those properties on their rent rather than the owner's income.",
  },
  "madera-county-ca": {
    borrowers:
      "Madera County's self-employed buyers include growers, ag contractors, builders and owners of small businesses in Madera, Chowchilla and the foothill towns near Oakhurst.",
    investors:
      "Investors look at single-family rentals in Madera and vacation-area homes near Oakhurst and Yosemite, where some DSCR lenders consider short-term rental income.",
  },
  "merced-county-ca": {
    borrowers:
      "Merced County's self-employed buyers range from farmers and dairy operators to contractors and Merced, Atwater and Los Banos business owners.",
    investors:
      "Rental demand around UC Merced and in Los Banos brings investors who use DSCR loans to buy without adding to their personal debt-to-income ratio.",
  },
  "san-joaquin-county-ca": {
    borrowers:
      "San Joaquin County's self-employed buyers include truck owner-operators and logistics contractors around Stockton, Tracy and Lathrop, plus Lodi growers and winery-related businesses.",
    investors:
      "Stockton, Tracy and Manteca have active rental markets where investors use DSCR loans to qualify a property on its rent.",
  },
  "stanislaus-county-ca": {
    borrowers:
      "Stanislaus County's self-employed buyers include almond and dairy operators, food-processing contractors, truckers and Modesto and Turlock business owners.",
    investors:
      "Investors buying rentals in Modesto, Turlock and Ceres use DSCR loans to qualify each property on its rent instead of their personal income.",
  },
  "tulare-county-ca": {
    borrowers:
      "Tulare County is one of California's largest farm counties, so self-employed buyers here are often growers, dairy operators, packing and ag service contractors, and Visalia and Porterville business owners.",
    investors:
      "Investors buy single-family rentals in Visalia, Tulare and Porterville, where a DSCR loan qualifies the property on its rent.",
  },
};

export function getSelfEmployedCounty(slug: string): { county: ReportCounty; angle: SelfEmployedCountyAngle } | undefined {
  const county = REPORT_COUNTIES.find((c) => c.slug === slug);
  const angle = county ? SELF_EMPLOYED_COUNTY_ANGLES[county.slug] : undefined;
  return county && angle ? { county, angle } : undefined;
}

/** The county page for a county name such as "Fresno County", when one exists. */
export function selfEmployedPathForCountyName(name: string): string | undefined {
  const county = REPORT_COUNTIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  return county && SELF_EMPLOYED_COUNTY_ANGLES[county.slug] ? selfEmployedCountyPath(county) : undefined;
}

export interface CountyLoanFacts {
  year: number;
  total: number;
  previousYear: number;
  previousTotal: number;
  /** Percent change in originations from the previous year, rounded. */
  change: number;
  cashOut: number;
  cashOutShare: number;
  conventionalShare: number;
  purchase: number;
  purchaseShare: number;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((100 * part) / whole) : 0);

export function countyLoanFacts(county: ReportCounty): CountyLoanFacts {
  const latest = county.years[LATEST_YEAR];
  const previous = county.years[PREVIOUS_YEAR];
  return {
    year: LATEST_YEAR,
    total: latest.total.count,
    previousYear: PREVIOUS_YEAR,
    previousTotal: previous.total.count,
    change: pct(latest.total.count - previous.total.count, previous.total.count),
    cashOut: latest.purposes.cashOutRefinance.count,
    cashOutShare: pct(latest.purposes.cashOutRefinance.count, latest.total.count),
    conventionalShare: pct(latest.loanTypes.conventional.count, latest.total.count),
    purchase: latest.purposes.purchase.count,
    purchaseShare: pct(latest.purposes.purchase.count, latest.total.count),
  };
}

const n = (value: number) => value.toLocaleString("en-US");
const listJoin = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join("");

export function countyShortAnswer(county: ReportCounty): string {
  return `Self-employed buyers in ${county.name} who have a down payment saved can apply for a mortgage with 12 or 24 months of bank statements instead of tax returns, and investors can qualify a rental on its rent with a DSCR loan. Both are non-QM loans from specialty lenders, so a local licensed loan officer is the place to compare them.`;
}

export function countyFaqs(county: ReportCounty): { q: string; a: string }[] {
  const facts = countyLoanFacts(county);
  const city = county.cities[0];
  return [
    {
      q: `Can I get a bank statement loan in ${city}?`,
      a: `Yes. Non-QM lenders that offer bank statement loans lend across ${county.name}, including ${listJoin(county.cities)}. A licensed loan officer can compare their guidelines for your situation.`,
    },
    {
      q: `Can I buy a rental in ${county.name} with a DSCR loan?`,
      a: `Yes. A DSCR loan qualifies the property on its rent compared with its monthly payment, so it is used for investment property only, not a home you live in.`,
    },
    {
      q: `How many home loans were made in ${county.name} in ${facts.year}?`,
      a: `Lenders reported ${n(facts.total)} originated home loans in ${county.name} in ${facts.year} under the Home Mortgage Disclosure Act, ${n(facts.cashOut)} of them cash-out refinances. HMDA does not separate bank statement or DSCR loans from other loans.`,
    },
    {
      q: "Do I need a down payment for these loans?",
      a: "Yes. Bank statement and DSCR loans usually need a larger down payment and more cash reserves than a conventional loan. They are not down payment assistance programs.",
    },
  ];
}

export function countyDataSentence(county: ReportCounty): string {
  const f = countyLoanFacts(county);
  const direction = f.change >= 0 ? `up ${f.change}%` : `down ${Math.abs(f.change)}%`;
  return `Lenders reported ${n(f.total)} originated home loans in ${county.name} in ${f.year}, ${direction} from ${n(f.previousTotal)} in ${f.previousYear}. ${n(f.purchase)} (${f.purchaseShare}%) were home purchases and ${n(f.cashOut)} (${f.cashOutShare}%) were cash-out refinances, and ${f.conventionalShare}% were conventional loans rather than FHA, VA or USDA.`;
}
