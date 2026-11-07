/**
 * Loan-officer-facing market pages (/loan-officers/<slug>). These target MLO search terms
 * ("mortgage leads for loan officers in Visalia", "loan officer marketing Visalia CA"), not
 * borrowers; borrower-facing local pages live in src/lib/local-seo.ts.
 *
 * To add a market, copy one entry and edit the text. Keep every statement something you can
 * stand behind: no invented statistics, rankings or lead volumes.
 */
export interface MloMarket {
  slug: string;
  city: string;
  stateCode: string;
  stateName: string;
  county: string;
  /** Residential delivery ZIPs a loan officer would realistically claim in this market. */
  zipCodes: string[];
  /** Nearby communities worth naming so the page answers "near me" searches honestly. */
  nearby: string[];
  title: string;
  description: string;
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
    title: "Mortgage Leads & AI Marketing for Loan Officers in Visalia, CA",
    description:
      "For loan officers in Visalia and Tulare County: claim a protected ZIP, let Cerebro AI answer and qualify your borrowers 24/7, and own every lead. Plans from $99. Check your ZIP free.",
    h1: "Visalia loan officers: own your ZIP and let Cerebro work your borrowers",
    intro:
      "YPN USA was built in the Central Valley by a loan officer with 25+ years in production. In Visalia, that means one loan officer per protected ZIP, an AI assistant that answers borrower questions on your own site at any hour, and leads that stay yours if you change companies.",
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
      q: `How do exclusive ZIP territories work in ${place}?`,
      a: "Each ZIP can be held by one YPN USA loan officer at a time. Every paid plan (Pro $99, Growth $199, Exclusive $299 per month) includes one protected ZIP, and borrower inquiries from that ZIP route to you, not to a competing loan officer. Checking a ZIP is free and does not reserve it.",
    },
    {
      q: "What does Cerebro do for a loan officer?",
      a: "Cerebro is an agentic AI assistant. For you, it builds a growth plan for your market, surfaces who needs follow-up and drafts local marketing for your review. For your borrowers, it answers questions 24/7 on your site, qualifies the inquiry and books time with you.",
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
