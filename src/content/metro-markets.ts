/**
 * Big-city market pages for loan officers (/markets/<slug>), rebuilt in November 2026 to
 * replace the old WordPress "/markets/leads-in-<city>" hubs that were lost in the move.
 *
 * Every number on these pages comes from public 2024 HMDA data for the city's core county
 * (src/content/metro-markets-data.ts). The local notes below are written by hand: keep each
 * one something a loan officer in that market would recognize, and never add rates, lead
 * volumes, rankings or promises. Titles ≤ 60 characters, descriptions ≤ 155.
 *
 * To add a city: fetch its county's 2024 loan_types and loan_purposes aggregations (see
 * metro-markets-data.ts), add the numbers there, add an entry here, and run `npm test`.
 */
import { METRO_HMDA_2024, type MetroYear } from "@/content/metro-markets-data";
import { averageLoan, formatCount, formatDollars, formatDollarsCompact, sharePercent } from "@/content/market-report";

export type MetroRegion = "Texas" | "Southwest" | "California" | "Midwest" | "Northeast" | "Southeast" | "Northwest";

export interface MetroMarket {
  /** URL slug under /markets, e.g. "houston-tx". */
  slug: string;
  city: string;
  stateCode: string;
  stateName: string;
  /** The county the HMDA numbers cover. */
  county: string;
  /** Five-digit county FIPS code; key into METRO_HMDA_2024. */
  fips: string;
  /** Other cities in the same county, named so the page answers nearby searches honestly. */
  nearby: readonly string[];
  region: MetroRegion;
  /** Old WordPress addresses that now 301 here. */
  legacyPaths: readonly string[];
  /** Two short paragraphs on what loan officers in this market deal with. */
  localNotes: readonly [string, string];
}

export const METRO_MARKETS: readonly MetroMarket[] = [
  {
    slug: "houston-tx",
    city: "Houston",
    stateCode: "TX",
    stateName: "Texas",
    county: "Harris County",
    fips: "48201",
    nearby: ["Pasadena", "Baytown", "Katy", "Humble", "Tomball"],
    region: "Texas",
    legacyPaths: ["/markets/leads-in-houston-tx"],
    localNotes: [
      "Texas home equity rules shape every cash-out conversation in Houston: a Texas cash-out loan on a homestead is capped at 80% of the home's value and comes with its own disclosures and waiting periods. Borrowers who expect a simple cash-out often need that explained before they apply.",
      "Flood risk is part of nearly every Houston purchase. Homes in a mapped flood zone need flood insurance for most loans, and the premium can change the payment a buyer qualifies for, so it pays to raise it early with buyers and their agents.",
    ],
  },
  {
    slug: "austin-tx",
    city: "Austin",
    stateCode: "TX",
    stateName: "Texas",
    county: "Travis County",
    fips: "48453",
    nearby: ["Pflugerville", "Lakeway", "Manor", "Bee Cave"],
    region: "Texas",
    legacyPaths: ["/markets/leads-in-austin-tx"],
    localNotes: [
      "Austin has a large tech workforce, so loan officers here see a lot of bonus, commission and stock-based pay. Underwriters want a history for that income, and borrowers who are new to a job or paid largely in stock need a clear plan before they write an offer.",
      "Like the rest of Texas, Austin cash-out refinances on a homestead follow the state's home equity rules, including the 80% loan-to-value cap. Many Austin homeowners compare a cash-out refinance with a home equity line or a second lien.",
    ],
  },
  {
    slug: "fort-worth-tx",
    city: "Fort Worth",
    stateCode: "TX",
    stateName: "Texas",
    county: "Tarrant County",
    fips: "48439",
    nearby: ["Arlington", "Grand Prairie", "Mansfield", "Keller", "Euless"],
    region: "Texas",
    legacyPaths: ["/markets/leads-in-fort-worth-tx"],
    localNotes: [
      "Tarrant County has a steady stream of military and veteran buyers, with Naval Air Station Joint Reserve Base Fort Worth in the county. Loan officers who know VA rules, entitlement and appraisal requirements have a real edge here.",
      "New-construction subdivisions on the edges of Fort Worth bring builder incentives and preferred-lender offers into many purchases. Buyers often ask a second loan officer to compare the builder's offer, which is a chance to win the loan on clear advice.",
    ],
  },
  {
    slug: "phoenix-az",
    city: "Phoenix",
    stateCode: "AZ",
    stateName: "Arizona",
    county: "Maricopa County",
    fips: "04013",
    nearby: ["Mesa", "Chandler", "Scottsdale", "Gilbert", "Glendale", "Tempe"],
    region: "Southwest",
    legacyPaths: ["/markets/leads-in-phoenix-az"],
    localNotes: [
      "New construction is a big part of the Maricopa County market, so Phoenix loan officers compete with builder-affiliated lenders on many purchases. Being the loan officer a buyer trusts before they walk into a model home matters.",
      "Luke Air Force Base is in the county, and VA buyers are a meaningful part of the Phoenix market. Many buyers also relocate from other states and shop online first, which rewards loan officers with a strong local page and fast answers.",
    ],
  },
  {
    slug: "tucson-az",
    city: "Tucson",
    stateCode: "AZ",
    stateName: "Arizona",
    county: "Pima County",
    fips: "04019",
    nearby: ["Oro Valley", "Marana", "Sahuarita", "South Tucson"],
    region: "Southwest",
    legacyPaths: ["/markets/leads-in-tucson-az"],
    localNotes: [
      "Davis-Monthan Air Force Base is in Tucson, so VA purchases and VA refinances are a steady part of the market. Loan officers who can explain the VA funding fee, entitlement and appraisal process clearly are well placed here.",
      "Tucson also draws retirees and university-related buyers, which means a wide mix of income types: retirement income, part-time pay and first-time buyers with thin credit. Documenting those incomes well is much of the job.",
    ],
  },
  {
    slug: "albuquerque-nm",
    city: "Albuquerque",
    stateCode: "NM",
    stateName: "New Mexico",
    county: "Bernalillo County",
    fips: "35001",
    nearby: ["Los Ranchos de Albuquerque", "Tijeras", "South Valley", "North Valley"],
    region: "Southwest",
    legacyPaths: ["/markets/leads-in-albuquerque-nm"],
    localNotes: [
      "Kirtland Air Force Base and Sandia National Laboratories are major Albuquerque employers, which brings a steady flow of VA buyers and federal and contractor employees. Relocation timelines often drive the purchase schedule.",
      "Albuquerque's price points make it a strong first-time buyer market. Loan officers who know FHA and state down payment programs, and who can walk a nervous first-time buyer through the process, tend to earn referrals.",
    ],
  },
  {
    slug: "las-vegas-nv",
    city: "Las Vegas",
    stateCode: "NV",
    stateName: "Nevada",
    county: "Clark County",
    fips: "32003",
    nearby: ["Henderson", "North Las Vegas", "Paradise", "Spring Valley", "Summerlin"],
    region: "Southwest",
    legacyPaths: ["/markets/leads-in-las-vegas-nv"],
    localNotes: [
      "Nellis Air Force Base is in Clark County, so VA loans are a regular part of Las Vegas business. Many borrowers also work in hospitality and gaming, where tips, shift differentials and variable hours need careful income documentation.",
      "Las Vegas has many homeowners associations and condo projects, and some condo and condo-hotel projects don't meet agency guidelines. Checking a project early saves a buyer from a surprise late in escrow.",
    ],
  },
  {
    slug: "los-angeles-ca",
    city: "Los Angeles",
    stateCode: "CA",
    stateName: "California",
    county: "Los Angeles County",
    fips: "06037",
    nearby: ["Long Beach", "Glendale", "Santa Clarita", "Pasadena", "Torrance", "Lancaster"],
    region: "California",
    legacyPaths: ["/markets/leads-in-los-angeles-ca"],
    localNotes: [
      "Los Angeles County is a high-cost area, so many loans here are high-balance conforming or jumbo loans with tighter reserve and down payment requirements. Loan officers who can compare those options clearly stand out.",
      "Homeowners insurance cost and availability has become a real part of Los Angeles transactions, especially near wildfire areas. Getting a quote early in the process protects the buyer's approval and the closing date.",
    ],
  },
  {
    slug: "san-diego-ca",
    city: "San Diego",
    stateCode: "CA",
    stateName: "California",
    county: "San Diego County",
    fips: "06073",
    nearby: ["Chula Vista", "Oceanside", "Escondido", "Carlsbad", "El Cajon"],
    region: "California",
    legacyPaths: [],
    localNotes: [
      "San Diego County is home to Naval Base San Diego, Marine Corps Base Camp Pendleton and other military installations, so VA loans are a large part of the market. Permanent change of station moves set many purchase timelines.",
      "It is also a high-cost county, where high-balance conforming and jumbo loans are common. Condos are a big share of the entry-level market, and project approval and HOA reviews belong at the start of the process.",
    ],
  },
  {
    slug: "san-jose-ca",
    city: "San Jose",
    stateCode: "CA",
    stateName: "California",
    county: "Santa Clara County",
    fips: "06085",
    nearby: ["Sunnyvale", "Santa Clara", "Mountain View", "Palo Alto", "Milpitas", "Cupertino"],
    region: "California",
    legacyPaths: ["/markets/leads-in-san-jose-ca"],
    localNotes: [
      "Santa Clara County is one of the highest-priced housing markets in the country, so jumbo loans and large down payments are normal. Many buyers are paid partly in restricted stock units, and underwriters need a vesting history to count that income.",
      "With high prices, many borrowers get help from family or use proceeds from selling stock for the down payment. Clear gift letters and sourced funds keep those files moving.",
    ],
  },
  {
    slug: "sacramento-ca",
    city: "Sacramento",
    stateCode: "CA",
    stateName: "California",
    county: "Sacramento County",
    fips: "06067",
    nearby: ["Elk Grove", "Citrus Heights", "Folsom", "Rancho Cordova", "Carmichael"],
    region: "California",
    legacyPaths: [],
    localNotes: [
      "State government is Sacramento's largest employer, so many borrowers have steady public-sector pay, pensions or both. Buyers also compare Sacramento with the Bay Area, and many move here for more space at a lower price.",
      "Sacramento has a large first-time buyer market, and California down payment programs come up often. Loan officers who know which programs fit which buyers can help more people get to the closing table.",
    ],
  },
  {
    slug: "portland-or",
    city: "Portland",
    stateCode: "OR",
    stateName: "Oregon",
    county: "Multnomah County",
    fips: "41051",
    nearby: ["Gresham", "Troutdale", "Fairview", "Wood Village"],
    region: "Northwest",
    legacyPaths: ["/markets/leads-in-portland-or"],
    localNotes: [
      "Portland has many older homes and a large condo market. Condo project reviews and older-home repair items are common hurdles, so loan officers who flag them early keep deals on track.",
      "Accessory dwelling units are common in Portland, and buyers ask whether rent from an ADU can count as income. The answer depends on the loan program, which makes it a good topic for local content.",
    ],
  },
  {
    slug: "boise-id",
    city: "Boise",
    stateCode: "ID",
    stateName: "Idaho",
    county: "Ada County",
    fips: "16001",
    nearby: ["Meridian", "Eagle", "Kuna", "Star", "Garden City"],
    region: "Northwest",
    legacyPaths: ["/markets/leads-in-boise-id"],
    localNotes: [
      "Ada County has drawn many buyers from out of state, including people relocating from California and Washington who shop online before they visit. Fast answers and a clear local presence help win those buyers.",
      "New-construction neighborhoods in Meridian, Kuna and Star mean builder incentives show up in many purchases. Buyers often want a second opinion on the builder's preferred-lender offer.",
    ],
  },
  {
    slug: "chicago-il",
    city: "Chicago",
    stateCode: "IL",
    stateName: "Illinois",
    county: "Cook County",
    fips: "17031",
    nearby: ["Evanston", "Oak Park", "Cicero", "Schaumburg", "Skokie", "Arlington Heights"],
    region: "Midwest",
    legacyPaths: ["/markets/leads-in-chicago-il"],
    localNotes: [
      "Chicago has a large stock of condos and two- to four-unit buildings, and many buyers want to live in one unit and rent the others. Loan officers who can explain how rental income counts on a multi-unit purchase have an advantage.",
      "Cook County property taxes are high compared with many markets, and they change the payment a buyer qualifies for. Showing taxes clearly in early numbers avoids surprises later.",
    ],
  },
  {
    slug: "detroit-mi",
    city: "Detroit",
    stateCode: "MI",
    stateName: "Michigan",
    county: "Wayne County",
    fips: "26163",
    nearby: ["Dearborn", "Livonia", "Westland", "Taylor", "Canton"],
    region: "Midwest",
    legacyPaths: ["/markets/leads-in-detroit-mi"],
    localNotes: [
      "Wayne County has many older homes, so appraisal repair items and renovation financing come up often. Loan officers who know renovation loan options can help buyers who find a home that needs work.",
      "Lower price points in many Detroit neighborhoods mean smaller loan amounts, where every fee stands out. Clear, early cost estimates build trust with first-time buyers.",
    ],
  },
  {
    slug: "indianapolis-in",
    city: "Indianapolis",
    stateCode: "IN",
    stateName: "Indiana",
    county: "Marion County",
    fips: "18097",
    nearby: ["Lawrence", "Beech Grove", "Speedway", "Southport"],
    region: "Midwest",
    legacyPaths: ["/markets/leads-in-indianapolis-in"],
    localNotes: [
      "Indianapolis is known as an affordable metro, which makes it a strong first-time buyer market. FHA and down payment help programs come up often, and buyers value a loan officer who explains each step.",
      "Investors are active in Indianapolis too, buying single-family rentals. Loan officers who can serve both owner-occupants and investors have more conversations to work with.",
    ],
  },
  {
    slug: "cleveland-oh",
    city: "Cleveland",
    stateCode: "OH",
    stateName: "Ohio",
    county: "Cuyahoga County",
    fips: "39035",
    nearby: ["Parma", "Lakewood", "Euclid", "Cleveland Heights", "Strongsville"],
    region: "Midwest",
    legacyPaths: ["/markets/leads-in-cleveland-oh"],
    localNotes: [
      "Cuyahoga County has an older housing stock and some of the lower price points of any large metro. Repairs, inspections and renovation financing come up often, and loan amounts can be small.",
      "Many Cleveland buyers are first-time buyers coming from renting. Patient education and clear payment estimates turn more of those conversations into closed loans.",
    ],
  },
  {
    slug: "brooklyn-ny",
    city: "Brooklyn",
    stateCode: "NY",
    stateName: "New York",
    county: "Kings County",
    fips: "36047",
    nearby: ["Williamsburg", "Park Slope", "Bay Ridge", "Bushwick", "Flatbush"],
    region: "Northeast",
    legacyPaths: ["/markets/leads-in-brooklyn-ny"],
    localNotes: [
      "Brooklyn buyers often purchase co-ops and condos, and co-op purchases need lender approval of the building plus a board package. Loan officers who know co-op lending and move quickly on documents are valued by buyers and their attorneys.",
      "Two- to four-family homes are common too, and many owners count rent from the other units. Prices are high, so large down payments, sourced funds and jumbo loans are part of everyday work.",
    ],
  },
  {
    slug: "washington-dc",
    city: "Washington",
    stateCode: "DC",
    stateName: "District of Columbia",
    county: "District of Columbia",
    fips: "11001",
    nearby: ["Capitol Hill", "Columbia Heights", "Navy Yard", "Petworth", "Anacostia"],
    region: "Northeast",
    legacyPaths: ["/markets/leads-in-washington-dc"],
    localNotes: [
      "Washington has many federal employees, contractors and military members, and many buyers move in and out on government timelines. Steady salaries help, but relocations and security-clearance jobs shape when people buy.",
      "Condos and co-ops are a large part of the D.C. market, and the District runs its own first-time buyer help, such as the Home Purchase Assistance Program. Knowing those programs is a practical edge here.",
    ],
  },
  {
    slug: "charlotte-nc",
    city: "Charlotte",
    stateCode: "NC",
    stateName: "North Carolina",
    county: "Mecklenburg County",
    fips: "37119",
    nearby: ["Matthews", "Huntersville", "Cornelius", "Mint Hill", "Davidson"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-charlotte-nc"],
    localNotes: [
      "Charlotte is a major banking center, and many buyers work in finance or relocate here for work. Relocating buyers often shop for a loan officer online before they know the neighborhoods.",
      "North Carolina home purchases close with an attorney, so loan officers here work closely with closing attorneys as well as agents. Strong attorney relationships are a referral source of their own.",
    ],
  },
  {
    slug: "raleigh-nc",
    city: "Raleigh",
    stateCode: "NC",
    stateName: "North Carolina",
    county: "Wake County",
    fips: "37183",
    nearby: ["Cary", "Apex", "Wake Forest", "Holly Springs", "Garner"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-raleigh-nc"],
    localNotes: [
      "Wake County has grown quickly with jobs in and around Research Triangle Park, and many buyers relocate from other states. New-construction neighborhoods in Apex, Holly Springs and Wake Forest bring builder incentives into many deals.",
      "As in the rest of North Carolina, closings are handled by attorneys, so attorney and builder relationships matter alongside agent referrals.",
    ],
  },
  {
    slug: "charleston-sc",
    city: "Charleston",
    stateCode: "SC",
    stateName: "South Carolina",
    county: "Charleston County",
    fips: "45019",
    nearby: ["North Charleston", "Mount Pleasant", "James Island", "Johns Island"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-charleston-sc"],
    localNotes: [
      "Joint Base Charleston brings a steady flow of VA buyers. Charleston is also a coastal market, where flood zones, flood insurance and wind coverage can change a buyer's payment and approval.",
      "Second homes and short-term rentals are common in the area, and buyers ask how the property's use affects their loan. South Carolina purchases close with an attorney, so attorney relationships matter too.",
    ],
  },
  {
    slug: "nashville-tn",
    city: "Nashville",
    stateCode: "TN",
    stateName: "Tennessee",
    county: "Davidson County",
    fips: "47037",
    nearby: ["Antioch", "Madison", "Hermitage", "Bellevue", "Goodlettsville"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-nashville-tn"],
    localNotes: [
      "Nashville has drawn many out-of-state buyers in recent years, in part because Tennessee has no state tax on wages. Relocating buyers often pick a loan officer online before they choose an agent.",
      "Short-term rentals and investor purchases are part of the Nashville market, and local short-term rental permit rules affect which properties work for which buyers. Knowing the basics helps loan officers set the right expectations.",
    ],
  },
  {
    slug: "orlando-fl",
    city: "Orlando",
    stateCode: "FL",
    stateName: "Florida",
    county: "Orange County",
    fips: "12095",
    nearby: ["Winter Park", "Apopka", "Ocoee", "Winter Garden", "Maitland"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-orlando-fl"],
    localNotes: [
      "Florida homeowners insurance costs have risen sharply, and they now shape many Orlando approvals. Getting an insurance quote early protects the buyer's budget and the closing date.",
      "Florida's newer condo safety rules, including inspections and reserve requirements, have made some condo projects harder to finance. Orlando also has many second-home and vacation-rental buyers, whose loans follow different rules.",
    ],
  },
  {
    slug: "jacksonville-fl",
    city: "Jacksonville",
    stateCode: "FL",
    stateName: "Florida",
    county: "Duval County",
    fips: "12031",
    nearby: ["Jacksonville Beach", "Atlantic Beach", "Neptune Beach", "Baldwin"],
    region: "Southeast",
    legacyPaths: ["/markets/leads-in-jacksonville-fl"],
    localNotes: [
      "Naval Air Station Jacksonville and Naval Station Mayport make Jacksonville a strong VA market. Many purchases follow military moves, so speed and clear VA guidance win business.",
      "As across Florida, homeowners insurance and flood coverage now play a big part in approvals, and condo projects face newer inspection and reserve rules. Raising those early keeps closings on schedule.",
    ],
  },
];

export const METRO_HUB_PATH = "/markets";
export const metroPath = (m: Pick<MetroMarket, "slug">) => `${METRO_HUB_PATH}/${m.slug}`;

export function getMetroMarket(slug: string): MetroMarket | undefined {
  return METRO_MARKETS.find((m) => m.slug === slug);
}

export function metroData(m: MetroMarket): MetroYear {
  const data = METRO_HMDA_2024[m.fips];
  if (!data) throw new Error(`No HMDA data for ${m.slug} (${m.fips})`);
  return data;
}

/** "Houston, TX" */
export const metroLabel = (m: MetroMarket) => `${m.city}, ${m.stateCode}`;

export function metroTitle(m: MetroMarket): string {
  return `${m.city}, ${m.stateCode} Loan Officer Market Data 2024 | YPN USA`;
}

export function metroDescription(m: MetroMarket): string {
  const d = metroData(m);
  return `${formatCount(d.total.count)} home loans were made in ${m.county} in 2024. FHA, VA, purchase and refinance mix for ${m.city} loan officers, from HMDA data.`;
}

/** Rank (1 = highest) of a metro on a computed share, among all METRO_MARKETS. */
function rankBy(m: MetroMarket, share: (d: MetroYear) => number): number {
  const values = METRO_MARKETS.map((x) => ({ slug: x.slug, v: share(metroData(x)) })).sort((a, b) => b.v - a.v);
  return values.findIndex((x) => x.slug === m.slug) + 1;
}

const vaShare = (d: MetroYear) => sharePercent(d.loanTypes.va.count, d.total.count);
const fhaShare = (d: MetroYear) => sharePercent(d.loanTypes.fha.count, d.total.count);
const purchaseShare = (d: MetroYear) => sharePercent(d.purposes.purchase.count, d.total.count);
const cashOutShare = (d: MetroYear) => sharePercent(d.purposes.cashOutRefinance.count, d.total.count);

export const metroShares = { vaShare, fhaShare, purchaseShare, cashOutShare };

/** "highest" for 1, otherwise "4th highest". */
function rankWords(rank: number): string {
  return rank === 1 ? "highest" : `${ordinal(rank)} highest`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/**
 * Plain-English takeaways computed only from the county's own 2024 numbers and how they
 * compare with the other big-city markets on this site. No rates, forecasts or outcomes.
 */
export function metroTakeaways(m: MetroMarket): string[] {
  const d = metroData(m);
  const n = METRO_MARKETS.length;
  const lines: string[] = [];
  lines.push(
    `${formatCount(d.total.count)} home loans worth about ${formatDollarsCompact(d.total.sum)} were originated in ${m.county} in 2024.`,
  );
  lines.push(
    `Home purchases were ${purchaseShare(d)}% of those loans, the ${rankWords(rankBy(m, purchaseShare))} share of the ${n} big-city markets we track.`,
  );
  lines.push(
    `FHA loans were ${fhaShare(d)}% (${rankWords(rankBy(m, fhaShare))} of ${n}) and VA loans ${vaShare(d)}% (${rankWords(rankBy(m, vaShare))} of ${n}).`,
  );
  lines.push(
    `Refinances made up ${sharePercent(d.purposes.refinance.count + d.purposes.cashOutRefinance.count, d.total.count)}% of loans, and cash-out refinances alone ${cashOutShare(d)}%.`,
  );
  lines.push(`The average purchase loan was about ${formatDollars(averageLoan(d.purposes.purchase))}.`);
  return lines;
}

/** Questions shown on each page and emitted as FAQPage JSON-LD (same text, so they match). */
export function metroFaq(m: MetroMarket): Array<{ q: string; a: string }> {
  const d = metroData(m);
  return [
    {
      q: `How many home loans were made in ${m.city} in 2024?`,
      a: `Lenders reported ${formatCount(d.total.count)} originated home loans in ${m.county}, which includes ${m.city}, in 2024, according to public HMDA data. ${purchaseShare(d)}% were home purchases. Some small lenders don't report to HMDA, so the true total is somewhat higher.`,
    },
    {
      q: `What share of ${m.city} home loans were FHA or VA?`,
      a: `In 2024, FHA loans were ${fhaShare(d)}% and VA loans ${vaShare(d)}% of originated home loans in ${m.county}. Conventional loans were ${sharePercent(d.loanTypes.conventional.count, d.total.count)}%.`,
    },
    {
      q: `How do exclusive ZIP codes work for loan officers in ${m.city}?`,
      a: "Each ZIP code can be held by one YPN USA loan officer at a time. Every paid plan (Pro $99, Growth $199, Exclusive $299 per month) includes one ZIP code, and borrower inquiries from YPN USA pages for that ZIP code route to you, not to another YPN USA loan officer. Exclusivity applies within YPN USA. Checking a ZIP code is free and does not reserve it; it locks at your first payment.",
    },
    {
      q: "Is YPN USA a lender or a lead reseller?",
      a: "Neither. YPN USA provides marketing technology and territory tools to licensed mortgage loan officers. It does not make loans, and it does not resell the same lead to several loan officers. No results are guaranteed.",
    },
  ];
}

/** Up to `limit` other metros, same region first, then the busiest of the rest. */
export function relatedMetros(m: MetroMarket, limit = 5): MetroMarket[] {
  const others = METRO_MARKETS.filter((x) => x.slug !== m.slug);
  const sameRegion = others.filter((x) => x.region === m.region);
  const rest = others
    .filter((x) => x.region !== m.region)
    .sort((a, b) => metroData(b).total.count - metroData(a).total.count);
  return [...sameRegion, ...rest].slice(0, limit);
}

/** Old addresses -> new page, for next.config.ts redirects and tests. */
export function metroLegacyRedirects(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of METRO_MARKETS) for (const p of m.legacyPaths) out[p] = metroPath(m);
  return out;
}
