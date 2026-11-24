/**
 * Top 100 metro mortgage markets (/markets/metro/<slug>), built November 2026.
 *
 * One page for each of the 100 HMDA metro areas (MSA/MDs) with the most 2024 HMDA loan records.
 * Every number comes from the CFPB/FFIEC HMDA Data Browser (src/content/metro-areas-data.ts).
 * The prose is generated from those numbers: each page says where its metro stands among the
 * 100, so the text differs from page to page because the markets differ. Never add rates, lead
 * volumes, lender names, rankings of lenders or promises here.
 *
 * Uniqueness is checked in metro-areas.test.ts (word-shingle similarity of each page's text
 * against every other page). Only pages that pass are indexable and listed in the sitemap.
 */
import { METRO_AREA_HMDA, METRO_AREA_META, type ActionCounts, type MetroAreaMeta, type MetroAreaHmda } from "@/content/metro-areas-data";
import { averageLoan, formatCount, formatDollars, formatDollarsCompact, sharePercent, type CountSum } from "@/content/market-report";

export const METRO_AREA_HUB_PATH = "/markets/metro";
export const METRO_AREA_YEAR = 2024;
export const METRO_AREA_PREV_YEAR = 2023;

export interface MetroArea extends MetroAreaMeta {
  /** 1 = most originated loans in 2024 among the 100. */
  rank: number;
}

const BY_ORIGINATIONS = [...METRO_AREA_META].sort(
  (a, b) => METRO_AREA_HMDA[b.code].y2024.actions.originated.count - METRO_AREA_HMDA[a.code].y2024.actions.originated.count,
);
export const METRO_AREAS: readonly MetroArea[] = BY_ORIGINATIONS.map((m, i) => ({ ...m, rank: i + 1 }));

export const metroAreaPath = (m: Pick<MetroAreaMeta, "slug">) => `${METRO_AREA_HUB_PATH}/${m.slug}`;
export function getMetroArea(slug: string): MetroArea | undefined {
  return METRO_AREAS.find((m) => m.slug === slug);
}
export function metroAreaByCode(code: string): MetroArea | undefined {
  return METRO_AREAS.find((m) => m.code === code);
}
/** The metro page that names this existing county-level page (e.g. "/markets/houston-tx"). */
export function metroAreaForCountyPage(path: string): MetroArea | undefined {
  return METRO_AREAS.find((m) => m.countyPage === path);
}
export const metroAreaData = (m: Pick<MetroAreaMeta, "code">): MetroAreaHmda => METRO_AREA_HMDA[m.code];

/* ------------------------------------------------------------------ metrics */

/** Applications that reached a credit decision or were closed by the applicant (HMDA actions 1-5). */
export function applications(a: ActionCounts): number {
  return a.originated.count + a.approvedNotAccepted.count + a.denied.count + a.withdrawn.count + a.incomplete.count;
}

export interface MetroAreaStats {
  originations: number;
  volume: number;
  avgLoan: number;
  avgPurchaseLoan: number;
  avgCashOutLoan: number;
  applications: number;
  purchaseShare: number;
  refiShare: number;
  cashOutShare: number;
  homeImprovementShare: number;
  otherPurposeShare: number;
  conventionalShare: number;
  fhaShare: number;
  vaShare: number;
  usdaShare: number;
  governmentShare: number;
  /** Denied / (originated + approved not accepted + denied). */
  denialRate: number;
  /** Withdrawn / applications (actions 1-5). */
  withdrawnRate: number;
  /** Closed for incompleteness / applications (actions 1-5). */
  incompleteRate: number;
  /** Originations change vs 2023, only where the HMDA area is comparable; else null. */
  originationsChange: number | null;
  purchasedLoans: number;
}

const pct = (part: number, whole: number) => sharePercent(part, whole);

/**
 * HMDA metro areas were redrawn for 2024 (OMB's 2023 delineations), so a year-over-year change is
 * shown only where the same code and name exist in both years and the 2023 HMDA record count is
 * close enough to 2024 that a boundary change is unlikely (see the data file for the flag).
 */
export function metroAreaStats(m: Pick<MetroAreaMeta, "code">): MetroAreaStats {
  const d = metroAreaData(m);
  const a = d.y2024.actions;
  const t = d.y2024.loanTypes;
  const p = d.y2024.purposes;
  const n = a.originated.count;
  const apps = applications(a);
  const prev = d.y2023 && d.comparableTo2023 ? d.y2023.actions.originated.count : null;
  return {
    originations: n,
    volume: a.originated.sum,
    avgLoan: averageLoan(a.originated),
    avgPurchaseLoan: averageLoan(p.purchase),
    avgCashOutLoan: averageLoan(p.cashOutRefinance),
    applications: apps,
    purchaseShare: pct(p.purchase.count, n),
    refiShare: pct(p.refinance.count, n),
    cashOutShare: pct(p.cashOutRefinance.count, n),
    homeImprovementShare: pct(p.homeImprovement.count, n),
    otherPurposeShare: pct(p.other.count, n),
    conventionalShare: pct(t.conventional.count, n),
    fhaShare: pct(t.fha.count, n),
    vaShare: pct(t.va.count, n),
    usdaShare: pct(t.usda.count, n),
    governmentShare: pct(t.fha.count + t.va.count + t.usda.count, n),
    denialRate: pct(a.denied.count, a.originated.count + a.approvedNotAccepted.count + a.denied.count),
    withdrawnRate: pct(a.withdrawn.count, apps),
    incompleteRate: pct(a.incomplete.count, apps),
    originationsChange: prev ? Math.round(((n - prev) / prev) * 1000) / 10 : null,
    purchasedLoans: a.purchased.count,
  };
}

export type MetricKey =
  | "originations"
  | "avgLoan"
  | "avgPurchaseLoan"
  | "purchaseShare"
  | "refiShare"
  | "cashOutShare"
  | "homeImprovementShare"
  | "fhaShare"
  | "vaShare"
  | "governmentShare"
  | "denialRate"
  | "withdrawnRate"
  | "originationsChange";

const STATS = new Map(METRO_AREAS.map((m) => [m.code, metroAreaStats(m)]));
export const statsFor = (m: Pick<MetroAreaMeta, "code">): MetroAreaStats => STATS.get(m.code) ?? metroAreaStats(m);

function values(key: MetricKey): number[] {
  return METRO_AREAS.map((m) => statsFor(m)[key]).filter((v): v is number => v !== null);
}

/** Median of a metric across the 100 (only metros that have it). */
export function metricMedian(key: MetricKey): number {
  const v = [...values(key)].sort((x, y) => x - y);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  const med = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return key === "avgLoan" || key === "avgPurchaseLoan" ? Math.round(med / 1000) * 1000 : Math.round(med * 10) / 10;
}

/** 1 = highest value among metros that have the metric. Ties share the better place. */
export function metricRank(m: Pick<MetroAreaMeta, "code">, key: MetricKey): { place: number; of: number } | null {
  const mine = statsFor(m)[key];
  if (mine === null) return null;
  const v = values(key);
  return { place: v.filter((x) => x > mine).length + 1, of: v.length };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** "the 4th highest of the 100" / "the 3rd lowest of the 96" */
export function placeText(r: { place: number; of: number }): string {
  const fromTop = r.place;
  const fromBottom = r.of - r.place + 1;
  if (fromTop <= fromBottom) return fromTop === 1 ? `the highest of the ${r.of}` : `the ${ordinal(fromTop)} highest of the ${r.of}`;
  return fromBottom === 1 ? `the lowest of the ${r.of}` : `the ${ordinal(fromBottom)} lowest of the ${r.of}`;
}

/* ------------------------------------------------------------------ text */

/** Stable small hash so each metro picks its own wording variant, the same on every build. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pick<T>(m: Pick<MetroAreaMeta, "code">, salt: string, options: readonly T[]): T {
  return options[hash(`${m.code}:${salt}`) % options.length];
}

export const metroAreaLabel = (m: Pick<MetroAreaMeta, "short">) => `${m.short} metro`;

export function metroAreaTitle(m: MetroArea): string {
  const full = `${m.short} Mortgage Market Data ${METRO_AREA_YEAR} | YPN USA`;
  return full.length <= 60 ? full : `${m.short} Mortgage Data ${METRO_AREA_YEAR} | YPN USA`;
}

export function metroAreaDescription(m: MetroArea): string {
  const s = statsFor(m);
  return `${formatCount(s.originations)} home loans, ${formatDollars(s.avgLoan)} average, ${s.purchaseShare}% purchase, ${s.governmentShare}% FHA/VA/USDA in the ${m.name} area (HMDA ${METRO_AREA_YEAR}). What it means for loan officers.`;
}

/** One-paragraph introduction, shaped by the metro's size and its two strongest traits. */
export function metroAreaIntro(m: MetroArea): string {
  const s = statsFor(m);
  const size =
    m.rank <= 10
      ? pick(m, "size", [
          `one of the ten busiest mortgage markets in the country`,
          `a top-ten mortgage market by loan count`,
          `among the ten largest home lending markets in the US`,
        ])
      : m.rank <= 40
        ? pick(m, "size", [`a large, active home lending market`, `one of the bigger mortgage markets on this list`, `a high-volume mortgage market`])
        : pick(m, "size", [`a mid-sized mortgage market with steady volume`, `a smaller market on this list, but still busy`, `a mid-sized home lending market`]);
  const volume = formatDollarsCompact(s.volume);
  return pick(m, "intro", [
    `Lenders originated ${formatCount(s.originations)} home loans worth about ${volume} in the ${m.name} HMDA metro area in ${METRO_AREA_YEAR}, which makes it ${size}: number ${m.rank} of the 100 metro areas we cover.`,
    `The ${m.name} area is ${size}. Lenders reported ${formatCount(s.originations)} originated home loans there in ${METRO_AREA_YEAR}, about ${volume} in total, ranking it ${ordinal(m.rank)} of 100 metro areas by loan count.`,
    `In ${METRO_AREA_YEAR}, ${formatCount(s.originations)} home loans closed in the ${m.name} metro area, adding up to roughly ${volume}. That puts it ${ordinal(m.rank)} among the 100 metro areas on this list, ${size}.`,
  ]);
}

interface Trait {
  key: MetricKey;
  /** 0..1, how far this metro sits from the middle of the 100 on this metric. */
  strength: number;
  high: boolean;
}

/** Traits sorted by how unusual the metro is, most unusual first. */
export function metroAreaTraits(m: Pick<MetroAreaMeta, "code">): Trait[] {
  const keys: MetricKey[] = [
    "fhaShare",
    "vaShare",
    "purchaseShare",
    "refiShare",
    "cashOutShare",
    "homeImprovementShare",
    "avgLoan",
    "denialRate",
    "withdrawnRate",
    "originationsChange",
  ];
  const out: Trait[] = [];
  for (const key of keys) {
    const r = metricRank(m, key);
    if (!r) continue;
    const pos = (r.place - 1) / Math.max(1, r.of - 1); // 0 = highest, 1 = lowest
    out.push({ key, strength: Math.abs(pos - 0.5) * 2, high: pos < 0.5 });
  }
  return out.sort((a, b) => b.strength - a.strength || a.key.localeCompare(b.key));
}

const fmt = (key: MetricKey, v: number) => (key === "avgLoan" || key === "avgPurchaseLoan" ? formatDollars(v) : key === "originationsChange" ? `${v > 0 ? "+" : ""}${v}%` : `${v}%`);

/** How a metro sits against the 100 on one metric, worded several ways so pages read differently. */
function comparison(m: MetroArea, t: Trait): string {
  const r = metricRank(m, t.key)!;
  const med = fmt(t.key, metricMedian(t.key));
  const fromTop = r.place;
  const fromBottom = r.of - r.place + 1;
  const high = fromTop <= fromBottom;
  const n = high ? fromTop : fromBottom;
  const dir = high ? "highest" : "lowest";
  const others = r.of - 1;
  const beat = high ? r.of - fromTop : r.of - fromBottom;
  const group = t.key === "originationsChange" ? `${r.of} comparable metros` : `${r.of} metros`;
  return pick(m, `cmp-${t.key}`, [
    `${n === 1 ? `the ${dir}` : `the ${ordinal(n)} ${dir}`} of the ${group} (median ${med})`,
    `${n === 1 ? "top" : ordinal(n)} on the ${dir === "highest" ? "high" : "low"} side among ${group}, where the middle value is ${med}`,
    `${high ? "above" : "below"} ${beat} of the other ${others} ${t.key === "originationsChange" ? "comparable metros" : "metros"}; the median is ${med}`,
    `against a typical ${med} across the ${group}, ranking ${ordinal(n)} ${dir}`,
  ]);
}

/** A sentence describing one trait with the metro's number and how it compares. */
function traitFinding(m: MetroArea, t: Trait): string {
  const s = statsFor(m);
  const v = s[t.key] as number;
  const val = fmt(t.key, v);
  const c = comparison(m, t);
  const x = m.short;
  const H = t.high;
  const opts: Record<MetricKey, [string[], string[]]> = {
    fhaShare: [
      [
        `FHA loans were ${val} of originations, ${c}. A large share of ${x} buyers lean on low down payments and flexible credit rules.`,
        `At ${val} of loans, FHA plays a bigger role in ${x} than in most big markets: ${c}.`,
        `${x} borrowers used FHA financing for ${val} of their loans, ${c}, which points to many first-time and credit-rebuilding buyers.`,
      ],
      [
        `Only ${val} of loans were FHA, ${c}, so conventional financing does most of the work in ${x}.`,
        `FHA is a small slice of the ${x} market at ${val} of originations, ${c}.`,
        `${x} leans away from FHA: ${val} of loans, ${c}.`,
      ],
    ],
    vaShare: [
      [
        `VA loans made up ${val} of originations, ${c}. Veterans and service members are a real customer group in ${x}.`,
        `${x} is a VA market: ${val} of loans were VA-guaranteed, ${c}.`,
        `One loan in ${Math.max(2, Math.round(100 / v))} in ${x} was a VA loan (${val}), ${c}.`,
      ],
      [`VA loans were ${val} of ${x} originations, ${c}.`, `The VA share in ${x} is low at ${val}, ${c}.`, `${x} sees few VA loans: ${val}, ${c}.`],
    ],
    purchaseShare: [
      [
        `Home purchases were ${val} of originations, ${c}. Buyers, not refinancers, drive ${x}.`,
        `${val} of ${x} loans financed a home purchase, ${c}.`,
        `${x} is a buyer's market for loan officers: purchase loans were ${val} of the total, ${c}.`,
      ],
      [
        `Purchase loans were only ${val} of originations, ${c}, so existing owners make up much of the ${x} business.`,
        `With purchases at ${val} of loans (${c}), refinances, equity loans and other borrowing carry more weight in ${x} than in most metros.`,
        `Fewer ${x} loans went to buyers than in most metros: purchases were ${val}, ${c}.`,
      ],
    ],
    refiShare: [
      [
        `Rate-and-term refinances were ${val} of loans, ${c}. ${x} owners refinance readily when the numbers work.`,
        `Refinances without cash out made up ${val} of ${x} originations, ${c}.`,
        `${x} has an active refinance crowd: ${val} of loans were rate-and-term refinances, ${c}.`,
      ],
      [
        `Rate-and-term refinances were just ${val} of ${x} loans, ${c}.`,
        `Plain refinances are rare in ${x}: ${val} of originations, ${c}.`,
        `Few ${x} owners refinanced without taking cash out (${val} of loans), ${c}.`,
      ],
    ],
    cashOutShare: [
      [
        `Cash-out refinances were ${val} of originations, ${c}, averaging ${formatDollars(s.avgCashOutLoan)}. ${x} owners tap equity often.`,
        `${val} of ${x} loans were cash-out refinances (${c}), with an average loan of ${formatDollars(s.avgCashOutLoan)}.`,
        `Equity is in play in ${x}: cash-out refinances were ${val} of loans, ${c}, at ${formatDollars(s.avgCashOutLoan)} on average.`,
      ],
      [
        `Cash-out refinances were ${val} of ${x} loans, ${c}.`,
        `Equity cash-outs are a small part of the ${x} market at ${val} of originations, ${c}.`,
        `${x} owners rarely took cash out: ${val} of loans, ${c}.`,
      ],
    ],
    homeImprovementShare: [
      [
        `Home improvement loans were ${val} of originations, ${c}. Many ${x} owners borrow to renovate rather than move.`,
        `${val} of ${x} loans were for home improvement, ${c}.`,
        `Renovation borrowing is strong in ${x}: ${val} of loans, ${c}.`,
      ],
      [
        `Home improvement loans were ${val} of ${x} originations, ${c}.`,
        `Renovation borrowing is light in ${x}: ${val} of loans, ${c}.`,
        `Few ${x} loans paid for home improvements (${val}), ${c}.`,
      ],
    ],
    avgLoan: [
      [
        `The average ${x} loan was ${val}, ${c}, and the average purchase loan was ${formatDollars(s.avgPurchaseLoan)}. Bigger loans mean more conforming-limit and jumbo conversations.`,
        `Loans run large in ${x}: ${val} on average, ${c}, with purchase loans averaging ${formatDollars(s.avgPurchaseLoan)}.`,
        `${x} is a high-balance market. The average loan was ${val} (${c}) and buyers borrowed ${formatDollars(s.avgPurchaseLoan)} on average.`,
      ],
      [
        `The average ${x} loan was ${val}, ${c}; purchase loans averaged ${formatDollars(s.avgPurchaseLoan)}.`,
        `Loan sizes are modest in ${x}: ${val} on average, ${c}, and ${formatDollars(s.avgPurchaseLoan)} for purchases.`,
        `${x} buyers borrowed ${formatDollars(s.avgPurchaseLoan)} on average, and the average loan of any kind was ${val}, ${c}.`,
      ],
    ],
    denialRate: [
      [
        `Lenders denied ${val} of decided applications in ${x}, ${c}. Credit and debt-to-income problems stop more deals here.`,
        `The ${x} denial rate was ${val} of applications that reached a decision, ${c}.`,
        `More ${x} applicants hear no: ${val} of decided applications were denied, ${c}.`,
      ],
      [
        `Only ${val} of decided ${x} applications were denied, ${c}, so applicants tend to arrive well qualified.`,
        `Denials were low in ${x} at ${val} of decided applications, ${c}.`,
        `${x} applicants mostly get to yes: just ${val} of decided applications were denied, ${c}.`,
      ],
    ],
    withdrawnRate: [
      [
        `${val} of ${x} applications were withdrawn by the borrower, ${c}. Borrowers shop around and walk away often.`,
        `Applicants in ${x} withdrew ${val} of applications, ${c}, a sign of heavy rate shopping.`,
        `${x} borrowers walk away more than most: ${val} of applications were withdrawn, ${c}.`,
      ],
      [
        `Only ${val} of ${x} applications were withdrawn, ${c}.`,
        `Withdrawals were low in ${x}: ${val} of applications, ${c}.`,
        `Once ${x} borrowers apply they tend to stay; ${val} withdrew, ${c}.`,
      ],
    ],
    originationsChange: [
      [
        `${x} originations grew ${val} from ${METRO_AREA_PREV_YEAR} to ${METRO_AREA_YEAR}, ${c}.`,
        `Loan count in ${x} rose ${val} year over year, ${c}.`,
        `${x} added loans fast: ${val} more originations than in ${METRO_AREA_PREV_YEAR}, ${c}.`,
      ],
      [
        `${x} originations changed ${val} from ${METRO_AREA_PREV_YEAR} to ${METRO_AREA_YEAR}, ${c}.`,
        `Loan count in ${x} moved ${val} year over year, ${c}.`,
        `${x} grew more slowly than most: ${val} versus ${METRO_AREA_PREV_YEAR}, ${c}.`,
      ],
    ],
    originations: [[], []],
    avgPurchaseLoan: [[], []],
    governmentShare: [[], []],
  };
  const list = opts[t.key][H ? 0 : 1];
  return list.length ? pick(m, `f-${t.key}`, list) : "";
}

/** What the trait means for a loan officer's marketing, one short paragraph. */
function traitPlay(m: MetroArea, t: Trait): { title: string; body: string } {
  const s = statsFor(m);
  const x = m.short;
  const P = (salt: string, list: string[]) => pick(m, `p-${salt}`, list);
  switch (t.key) {
    case "fhaShare":
      return t.high
        ? {
            title: "Lead with first-time buyer help",
            body: P("fh", [
              `With ${s.fhaShare}% of ${x} loans going FHA, plain answers on mortgage insurance, minimum down payments and seller-paid costs bring in calls. A first-time buyer page for your ZIP code and a short checklist for agents do more here than rate ads.`,
              `FHA borrowers want someone to walk them through it. Publish how FHA mortgage insurance works, what credit scores qualify and how down payment help stacks with FHA, then follow up fast; ${s.fhaShare}% of the ${x} market is this buyer.`,
              `In ${x}, ${s.fhaShare}% of borrowers chose FHA. Host a first-time buyer night with a local agent, post an FHA cost breakdown for your ZIP code and keep a down payment assistance list ready.`,
            ]),
          }
        : {
            title: "Compete on conventional",
            body: P("fh", [
              `Conventional loans were ${s.conventionalShare}% of the ${x} market, so borrowers compare private mortgage insurance, down payment options and pricing. Clear PMI explanations and quick quotes win more than government-loan content.`,
              `In a ${s.conventionalShare}% conventional market like ${x}, buyers ask how much to put down and when PMI comes off. Answer those on your page and in follow-up emails.`,
              `${x} borrowers mostly go conventional (${s.conventionalShare}%). Show the payment at 5%, 10% and 20% down and explain when mortgage insurance drops off; that is the comparison they are making.`,
            ]),
          };
    case "vaShare":
      return t.high
        ? {
            title: "Be the local VA expert",
            body: P("va", [
              `${s.vaShare}% of ${x} loans were VA. Content on the VA funding fee, entitlement, reusing a VA loan and VA appraisals answers what these buyers search for, and agents refer to loan officers who close VA loans smoothly.`,
              `VA buyers are ${s.vaShare}% of the ${x} market. A ZIP code page that explains entitlement, the funding fee exemption for disabled veterans and VA appraisal timelines earns trust before the first call.`,
              `With ${s.vaShare}% VA lending, ${x} rewards loan officers who know the program cold: second-use entitlement, VA cash-out and IRRRL refinances, and how to keep a VA offer competitive.`,
            ]),
          }
        : {
            title: "Keep VA content focused",
            body: P("va", [
              `VA loans were ${s.vaShare}% of ${x} originations, so VA-only campaigns reach a thin slice of buyers. Keep one VA answer page and put the main effort where the volume is.`,
              `Only ${s.vaShare}% of ${x} loans were VA. One solid VA page covers that demand; spend the rest of your time on the loan types that dominate locally.`,
            ]),
          };
    case "purchaseShare":
      return t.high
        ? {
            title: "Build agent partnerships",
            body: P("pu", [
              `${s.purchaseShare}% of ${x} loans were purchases, so most business starts with a buyer and an agent. Fast pre-approvals, a co-branded calculator for agents and weekend availability matter more than refinance campaigns.`,
              `Purchase loans were ${s.purchaseShare}% of the ${x} market. Be the loan officer agents can reach on a Saturday, and give their buyers a payment calculator with your name on it.`,
              `${x} runs on purchase business (${s.purchaseShare}% of loans). Ten agents who trust your pre-approvals are worth more than any refinance list here.`,
            ]),
          }
        : {
            title: "Work your past clients",
            body: P("pu", [
              `Only ${s.purchaseShare}% of ${x} loans were purchases. Refinances, cash-outs and other owner borrowing are a large share, so a database of past clients and homeowners in your ZIP code is worth regular check-ins.`,
              `With purchases at ${s.purchaseShare}%, ${x} owners are a big part of the business. Annual mortgage reviews and equity check-ins keep you first in line when they borrow again.`,
              `${x} homeowners borrow often, and purchases were just ${s.purchaseShare}% of loans. Send every past client a yearly review of their rate, balance and equity.`,
            ]),
          };
    case "refiShare":
      return t.high
        ? {
            title: "Keep a rate-watch list",
            body: P("rf", [
              `Rate-and-term refinances were ${s.refiShare}% of ${x} loans. Collect homeowners who want to hear when a refinance pays off, and tell them the break-even month, not just the rate.`,
              `${x} owners refinance when it pays (${s.refiShare}% of loans). A simple rate-alert sign-up on your page builds the list you will call when rates drop.`,
            ]),
          }
        : {
            title: "Do not wait on refinances",
            body: P("rf", [
              `Rate-and-term refinances were only ${s.refiShare}% of ${x} loans, so a pipeline built on refinance waves will be thin. Purchase and equity borrowers carry this market.`,
              `At ${s.refiShare}% of loans, plain refinances will not fill a ${x} pipeline. Plan your marketing around buyers and equity borrowers instead.`,
            ]),
          };
    case "cashOutShare":
      return t.high
        ? {
            title: "Offer equity reviews",
            body: P("co", [
              `Cash-out refinances were ${s.cashOutShare}% of ${x} loans, averaging ${formatDollars(s.avgCashOutLoan)}. Owners want to compare a cash-out with a home equity line or second lien; a side-by-side on your page and an equity check for past clients both earn calls.`,
              `${s.cashOutShare}% of ${x} loans were cash-outs. Homeowners ask what they can borrow and what it costs against a HELOC, so lead with that comparison.`,
              `${x} owners tap equity (${s.cashOutShare}% cash-out). Debt consolidation and renovation math, shown plainly next to a home equity line, is the content that converts here.`,
            ]),
          }
        : {
            title: "Keep equity content short",
            body: P("co", [
              `Cash-outs were ${s.cashOutShare}% of ${x} loans, below most metros. One clear page on cash-out versus home equity lines covers the demand.`,
              `With cash-outs at ${s.cashOutShare}% of ${x} loans, equity campaigns are a side line. A single comparison page is enough.`,
            ]),
          };
    case "homeImprovementShare":
      return t.high
        ? {
            title: "Talk renovation financing",
            body: P("hi", [
              `Home improvement loans were ${s.homeImprovementShare}% of ${x} originations. Owners are fixing up instead of moving, so renovation loans, equity lines and contractor relationships are worth your time.`,
              `${x} owners renovate (${s.homeImprovementShare}% of loans were for home improvement). Partner with a few contractors and explain renovation loan options on your page.`,
            ]),
          }
        : {
            title: "Focus on buyers and refinances",
            body: P("hi", [
              `Home improvement lending was ${s.homeImprovementShare}% of ${x} loans, so renovation campaigns reach few borrowers. Keep the focus on purchase and refinance demand.`,
              `Renovation loans were ${s.homeImprovementShare}% of the ${x} total. Spend your marketing on the purchase and refinance borrowers who make up the rest.`,
            ]),
          };
    case "avgLoan":
      return t.high
        ? {
            title: "Prepare for high-balance loans",
            body: P("al", [
              `With an average ${x} loan of ${formatDollars(s.avgLoan)}, many borrowers sit near or above conforming limits. Know your county's limit, your jumbo options and the reserves they require, and say so on your page.`,
              `${x} loans average ${formatDollars(s.avgLoan)}. Borrowers ask about jumbo rules, reserves and how much down keeps them conforming, so answer those up front.`,
              `High balances (${formatDollars(s.avgLoan)} on average) make ${x} a jumbo and high-balance market. Asset documentation and reserve requirements are worth a page of their own.`,
            ]),
          }
        : {
            title: "Make first-time programs easy to find",
            body: P("al", [
              `With ${x} purchase loans averaging ${formatDollars(s.avgPurchaseLoan)}, more buyers fit first-time buyer and down payment assistance programs. List the ones you offer and who qualifies.`,
              `Average purchase loans of ${formatDollars(s.avgPurchaseLoan)} keep homeownership within reach in ${x}. Renters comparing rent to a payment are a real audience; show them the math.`,
            ]),
          };
    case "denialRate":
      return t.high
        ? {
            title: "Pre-qualify and coach",
            body: P("dn", [
              `${s.denialRate}% of decided ${x} applications were denied. Catching credit and debt-to-income problems early, and giving borrowers a plan to fix them, turns a likely denial into a later closing.`,
              `With a ${s.denialRate}% denial rate in ${x}, a quick pre-qualification and a credit plan for borrowers who are not ready yet will save deals that other loan officers lose.`,
              `${x} has many borrowers who are close but not ready (${s.denialRate}% denied). A 90-day credit plan and regular check-ins turn them into next season's closings.`,
            ]),
          }
        : {
            title: "Compete on speed and service",
            body: P("dn", [
              `Only ${s.denialRate}% of decided ${x} applications were denied, so most applicants qualify somewhere. Winning them comes down to fast answers, clear fees and a smooth close.`,
              `${x} applicants usually qualify (${s.denialRate}% denied). The loan officer who answers first and explains fees clearly gets the file.`,
            ]),
          };
    case "withdrawnRate":
      return t.high
        ? {
            title: "Answer first",
            body: P("wd", [
              `${s.withdrawnRate}% of ${x} applications were withdrawn, so borrowers shop and leave. The loan officer who answers first and follows up the same day keeps more of them; Cerebro answers and qualifies borrowers 24/7.`,
              `${x} borrowers walk away from ${s.withdrawnRate}% of applications. Same-day follow-up and a clear timeline keep them; an assistant that answers at night helps.`,
            ]),
          }
        : {
            title: "Earn the first application",
            body: P("wd", [
              `Only ${s.withdrawnRate}% of ${x} applications were withdrawn, so once borrowers apply they tend to stay. Being the first loan officer they talk to matters most.`,
              `${x} applicants rarely withdraw (${s.withdrawnRate}%). The work is getting the first conversation, so local visibility pays off.`,
            ]),
          };
    case "originationsChange":
      return t.high
        ? {
            title: "Ride the growth",
            body: P("yc", [
              `${x} originations grew ${s.originationsChange}% year over year. A growing market rewards loan officers who are visible now, before competitors fill the local search results.`,
              `With loan count up ${s.originationsChange}% in ${x}, new borrowers are entering the market. Claim your local search presence while it is still open.`,
            ]),
          }
        : {
            title: "Win share in a slower market",
            body: P("yc", [
              `${x} originations changed ${s.originationsChange}% year over year. In a slower market, share comes from visibility and follow-up, not from volume rising on its own.`,
              `Loan count in ${x} moved ${s.originationsChange}% from ${METRO_AREA_PREV_YEAR}. Growth here has to come from taking share, so referral partners and follow-up matter.`,
            ]),
          };
    default:
      return { title: "", body: "" };
  }
}

/** Two sentences comparing the metro with its two closest-sized neighbors on the list. */
export function metroAreaPeerNotes(m: MetroArea): string[] {
  const keys: Array<[MetricKey, string]> = [
    ["fhaShare", "FHA share"],
    ["vaShare", "VA share"],
    ["purchaseShare", "purchase share"],
    ["cashOutShare", "cash-out share"],
    ["denialRate", "denial rate"],
    ["avgLoan", "average loan"],
  ];
  const s = statsFor(m);
  return metroAreaPeers(m, 2).map((o, i) => {
    const os = statsFor(o);
    let best: [MetricKey, string] = keys[0];
    let gap = -1;
    for (const k of keys) {
      const a = s[k[0]] as number;
      const b = os[k[0]] as number;
      const g = Math.abs(a - b) / Math.max(1, Math.abs(b));
      if (g > gap) {
        gap = g;
        best = k;
      }
    }
    const a = fmt(best[0], s[best[0]] as number);
    const b = fmt(best[0], os[best[0]] as number);
    const higher = (s[best[0]] as number) > (os[best[0]] as number);
    return pick(m, `peer${i}`, [
      `${o.name} is close in size (number ${o.rank}), but its ${best[1]} is ${b} against ${a} in ${m.short}.`,
      `Compared with ${o.short} (number ${o.rank} by loan count), ${m.short} has a ${higher ? "higher" : "lower"} ${best[1]}: ${a} versus ${b}.`,
      `The biggest difference from ${o.short}, a similar-sized market, is the ${best[1]}: ${a} here, ${b} there.`,
    ]);
  });
}

/** The 4 most unusual findings, as sentences. */
export function metroAreaFindings(m: MetroArea): string[] {
  return metroAreaTraits(m)
    .slice(0, 4)
    .map((t) => traitFinding(m, t));
}

/** Three marketing plays matched to the 3 most unusual traits. */
export function metroAreaPlays(m: MetroArea): Array<{ title: string; body: string }> {
  const seen = new Set<string>();
  const out: Array<{ title: string; body: string }> = [];
  for (const t of metroAreaTraits(m)) {
    const play = traitPlay(m, t);
    if (!play.title || seen.has(play.title)) continue;
    seen.add(play.title);
    out.push(play);
    if (out.length === 3) break;
  }
  return out;
}

/** Up to `n` metros closest in loan count, for a comparison table. */
export function metroAreaPeers(m: MetroArea, n = 4): MetroArea[] {
  return [...METRO_AREAS]
    .filter((x) => x.code !== m.code)
    .sort((a, b) => Math.abs(a.rank - m.rank) - Math.abs(b.rank - m.rank) || a.rank - b.rank)
    .slice(0, n)
    .sort((a, b) => a.rank - b.rank);
}

/** How YPN USA fits, tied to the metro's strongest trait. */
export function metroAreaYpnFit(m: MetroArea): string {
  const s = statsFor(m);
  const top = metroAreaTraits(m)[0];
  const hook =
    top?.key === "fhaShare" && top.high
      ? `first-time and FHA buyers, who make up ${s.fhaShare}% of the market`
      : top?.key === "vaShare" && top.high
        ? `VA buyers, ${s.vaShare}% of loans here`
        : top?.key === "purchaseShare" && top.high
          ? `buyers, who took out ${s.purchaseShare}% of the loans`
          : top?.key === "cashOutShare" && top.high
            ? `homeowners weighing a cash-out, ${s.cashOutShare}% of loans`
            : top?.key === "withdrawnRate" && top.high
              ? `borrowers who shop around (${s.withdrawnRate}% of applications were withdrawn)`
              : `the ${formatCount(s.originations)} borrowers a year who take out a loan here`;
  return pick(m, "ypn", [
    `YPN USA gives one loan officer a ZIP code at a time: a local page built for ${hook}, and Cerebro to answer and qualify borrowers 24/7. Check a ${m.short} ZIP code below; checking is free and does not reserve it.`,
    `On YPN USA, each ${m.short} ZIP code goes to a single loan officer. You get a local page aimed at ${hook}, plus Cerebro answering and qualifying borrowers around the clock. Checking a ZIP code below is free.`,
    `Hold a ${m.short} ZIP code on YPN USA and no other YPN USA loan officer can claim it while you do. Your page speaks to ${hook}, and Cerebro answers and qualifies borrowers 24/7. See whether yours is open below.`,
  ]);
}

export function metroAreaFaq(m: MetroArea): Array<{ q: string; a: string }> {
  const s = statsFor(m);
  const d = metroAreaData(m).y2024;
  const x = m.short;
  const P = (salt: string, list: string[]) => pick(m, `faq-${salt}`, list);
  const q2 = P("q2", [`What share of ${x} home loans were FHA or VA?`, `How common are FHA and VA loans in ${x}?`, `Which loan types dominate in ${x}?`]);
  return [
    {
      q: P("q1", [`How many home loans were made in the ${x} metro area in ${METRO_AREA_YEAR}?`, `How big is the ${x} mortgage market?`, `What was ${x} mortgage volume in ${METRO_AREA_YEAR}?`]),
      a: P("a1", [
        `Lenders reported ${formatCount(s.originations)} originated home loans worth about ${formatDollarsCompact(s.volume)} in the ${m.name} HMDA metro area in ${METRO_AREA_YEAR}. ${formatCount(d.purposes.purchase.count)} were home purchase loans.`,
        `${formatCount(s.originations)} loans, about ${formatDollarsCompact(s.volume)}, closed in the ${m.name} area in ${METRO_AREA_YEAR}, number ${m.rank} of the 100 metros here. Purchases accounted for ${formatCount(d.purposes.purchase.count)} of them.`,
      ]),
    },
    {
      q: q2,
      a:
        q2 === `Which loan types dominate in ${x}?`
          ? `Conventional loans led with ${s.conventionalShare}%. FHA followed at ${s.fhaShare}%, VA at ${s.vaShare}% and USDA at ${s.usdaShare}% (${formatCount(d.loanTypes.fha.count)} FHA and ${formatCount(d.loanTypes.va.count)} VA loans).`
          : `FHA loans were ${s.fhaShare}% and VA loans ${s.vaShare}% of ${METRO_AREA_YEAR} originations; USDA loans were ${s.usdaShare}%. Conventional loans were the other ${s.conventionalShare}%.`,
    },
    {
      q: P("q3", [`How often were mortgage applications denied in ${x}?`, `What is the mortgage denial rate in ${x}?`, `How many ${x} mortgage applications were approved?`]),
      a: P("a3", [
        `${s.denialRate}% of applications that reached a credit decision were denied in ${METRO_AREA_YEAR} (${formatCount(d.actions.denied.count)} denials). Another ${s.withdrawnRate}% of applications were withdrawn by the applicant.`,
        `Of ${formatCount(s.applications)} applications, ${formatCount(s.originations)} became loans and ${formatCount(d.actions.denied.count)} were denied, a ${s.denialRate}% denial rate on decided applications. Borrowers withdrew ${s.withdrawnRate}%.`,
      ]),
    },
    {
      q: P("q4", [`Can I get an exclusive ZIP code in the ${x} area on YPN USA?`, `Is my ${x} ZIP code available on YPN USA?`]),
      a: P("a4", [
        `Each ZIP code goes to one YPN USA loan officer at a time and locks at your first payment on a paid plan. Use the ZIP code check on this page to see whether yours is open; checking does not reserve it.`,
        `Check it on this page. A ZIP code is held by one YPN USA loan officer at a time and locks once the first payment on a paid plan goes through; checking alone does not hold it.`,
      ]),
    },
  ];
}

/** Every generated sentence a page shows, for the uniqueness check. */
export function metroAreaPageText(m: MetroArea): string {
  const plays = metroAreaPlays(m);
  return [
    metroAreaIntro(m),
    ...metroAreaFindings(m),
    ...metroAreaPeerNotes(m),
    ...plays.flatMap((p) => [p.title, p.body]),
    metroAreaYpnFit(m),
    ...metroAreaFaq(m).flatMap((f) => [f.q, f.a]),
  ].join(" ");
}

/* ------------------------------------------------------------------ uniqueness */

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9$%.\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** Word 5-gram shingles. `maskNumbers` replaces every number with one token (template check). */
export function shingles(text: string, maskNumbers = false, size = 5): Set<string> {
  const w = norm(text).map((x) => (maskNumbers && /\d/.test(x) ? "#" : x));
  const out = new Set<string>();
  for (let i = 0; i + size <= w.length; i++) out.add(w.slice(i, i + size).join(" "));
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Highest similarity of this metro's generated text to any other metro's (0..1). */
export function maxSimilarity(m: MetroArea, maskNumbers = false): { other: string; score: number } {
  const mine = shingles(metroAreaPageText(m), maskNumbers);
  let best = { other: "", score: 0 };
  for (const o of METRO_AREAS) {
    if (o.code === m.code) continue;
    const s = jaccard(mine, shingles(metroAreaPageText(o), maskNumbers));
    if (s > best.score) best = { other: o.slug, score: s };
  }
  return best;
}

/** Pages pass when no other page shares more than this share of word 5-grams with them. */
export const UNIQUENESS_THRESHOLD = 0.3;

let indexable: Set<string> | null = null;
/** Slugs whose generated text passes the uniqueness check. Computed once per process. */
export function indexableMetroAreaSlugs(): Set<string> {
  if (!indexable) indexable = new Set(METRO_AREAS.filter((m) => maxSimilarity(m).score <= UNIQUENESS_THRESHOLD).map((m) => m.slug));
  return indexable;
}
export const isMetroAreaIndexable = (m: Pick<MetroAreaMeta, "slug">) => indexableMetroAreaSlugs().has(m.slug);

export type { CountSum };
