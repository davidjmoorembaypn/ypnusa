/**
 * Loan-officer-facing market pages (/loan-officers/<slug>). These target MLO search terms
 * ("mortgage leads for loan officers in Visalia", "loan officer marketing Visalia CA"), not
 * borrowers; borrower-facing local pages live in src/lib/local-seo.ts.
 *
 * To add a market (Tulare, Hanford, Kingsburg and Fresno are next), copy one entry and write
 * unique local copy. Keep every statement something you can stand behind: no invented
 * statistics, rankings or lead volumes. Titles ≤ 60 characters, descriptions ≤ 155.
 */
import { PAGE_SEO } from "@/lib/seo/page-seo";

export interface MloMarket {
  slug: string;
  city: string;
  stateCode: string;
  stateName: string;
  county: string;
  /** Residential delivery ZIP codes a loan officer would realistically claim in this market. */
  zipCodes: string[];
  /** Nearby communities worth naming so the page answers "near me" searches honestly. */
  nearby: string[];
  /** Full <title>, used as-is. */
  title: string;
  /** Meta description. */
  description: string;
  /** One line for the market's card on the /loan-officers hub. */
  cardBlurb: string;
  h1: string;
  intro: string;
  whyHere: string;
  latitude: number;
  longitude: number;
}

export const MLO_MARKETS: readonly MloMarket[] = [
  {
    slug: "visalia-ca",
    city: "Visalia",
    stateCode: "CA",
    stateName: "California",
    county: "Tulare County",
    zipCodes: ["93277", "93291", "93292"],
    nearby: ["Tulare", "Exeter", "Farmersville", "Hanford", "Dinuba"],
    title: PAGE_SEO.visalia.title,
    description: PAGE_SEO.visalia.description,
    cardBlurb: "Visalia and Tulare County, with Tulare, Exeter and Hanford nearby.",
    h1: "Visalia loan officers: claim your ZIP code and let Cerebro work your borrowers",
    intro:
      "YPN USA was built in the Central Valley by a loan officer with 25+ years in production. In Visalia, that means one YPN USA loan officer per ZIP code, a local page for your market, and an AI assistant that answers borrower questions at any hour and hands the ready ones to you.",
    whyHere:
      "Visalia buyers often compare city neighborhoods with nearby towns and rural properties, so the first conversation matters. Cerebro captures the borrower's goal, timeline and price range up front and routes them to you, so you spend your time on the conversations that can close.",
    latitude: 36.3302,
    longitude: -119.2921,
  },
];

export function getMloMarket(slug: string): MloMarket | undefined {
  return MLO_MARKETS.find((market) => market.slug === slug);
}

/** Questions shown on every market page and the nationwide hub; also emitted as FAQPage JSON-LD. */
export function marketFaq(market?: MloMarket): Array<{ q: string; a: string }> {
  const place = market ? `${market.city}, ${market.stateCode}` : "your market";
  return [
    {
      q: `How do exclusive ZIP codes work in ${place}?`,
      a: "Each ZIP code can be held by one YPN USA loan officer at a time. Every paid plan (Pro $99, Growth $199, Exclusive $299 per month) includes one ZIP code, and borrower inquiries from YPN USA pages for that ZIP code route to you, not to another YPN USA loan officer. Exclusivity applies within YPN USA. Checking a ZIP code is free and does not reserve it; it locks at your first payment.",
    },
    {
      q: "What does Cerebro do for a loan officer?",
      a: "Cerebro is YPN USA's AI assistant. For you, it builds a growth plan for your market, surfaces who needs follow-up and drafts local marketing for your review. For your borrowers, it answers questions 24/7, qualifies the inquiry and hands the ready ones to you.",
    },
    {
      q: "Do I keep my leads if I change brokerages?",
      a: "Yes. Borrowers Cerebro captures for you are recorded under your account and stay yours on every plan, including if you move to another company.",
    },
    {
      q: "Is YPN USA a lender or a lead reseller?",
      a: "Neither. YPN USA provides marketing technology and territory tools to licensed mortgage loan officers. It does not make loans, and it does not resell the same lead to several loan officers. No results are guaranteed.",
    },
  ];
}
