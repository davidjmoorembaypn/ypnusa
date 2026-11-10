/**
 * Title tags and meta descriptions from the Nov 2026 SEO plan (section 13, "Page table").
 * One source so the length rules are tested: titles ≤ 60 characters (the full <title>,
 * brand included) and descriptions ≤ 155, so Google shows them without cutting them off.
 * Every title here is used as-is (absolute), never run through the "%s | YPN USA" template.
 */
export interface PageSeo {
  title: string;
  description: string;
}

export const PAGE_SEO = {
  home: {
    title: "Mortgage Lead Generation & AI for Loan Officers | YPN USA",
    description:
      "Cerebro answers and qualifies your borrowers 24/7 while you close loans, inside a ZIP code that's yours alone. Start free; plans from $99/mo.",
  },
  cerebro: {
    title: "Cerebro: AI Assistant for Mortgage Loan Officers | YPN USA",
    description:
      "Cerebro answers borrower questions 24/7, qualifies them, records every conversation and drafts your marketing. Try it free, no card needed.",
  },
  features: {
    title: "Features: Local Pages, ZIP Codes & AI Intake | YPN USA",
    description:
      "An exclusive ZIP code, local pages built to rank, and Cerebro AI intake and follow-up for mortgage loan officers. See everything included.",
  },
  pricing: {
    title: "Pricing: Free, Pro, Growth & Exclusive Plans | YPN USA",
    description:
      "Start free. Pro $99, Growth $199 or Exclusive $299 a month, each with a 15-day free trial and one ZIP code. Or prepay 5 years.",
  },
  loanOfficers: {
    title: "Loan Officer Markets: Check Your ZIP Code | YPN USA",
    description:
      "Find your market and see which ZIP codes are open. One loan officer per ZIP code, with local pages and Cerebro follow-up. Free to check.",
  },
  visalia: {
    title: "Visalia Loan Officers: Local Leads & AI Marketing | YPN USA",
    description:
      "For Visalia and Tulare County loan officers: claim a ZIP code, get a local page, and let Cerebro answer borrowers 24/7. Check yours free.",
  },
  teams: {
    title: "YPN USA for Mortgage Teams & Branch Managers",
    description:
      "Give every loan officer on your team a ZIP code, local pages and Cerebro AI follow-up from day one. Per-loan-officer plans from $99/mo.",
  },
  roi: {
    title: "Loan Officer Marketing ROI Calculator | YPN USA",
    description:
      "Enter your average loan size and compensation to see how many extra loans cover a YPN plan. Free, no sign-up needed.",
  },
  about: {
    title: "David J. Moore, MBA: Mortgage Expert & Author | YPN USA",
    description:
      "Meet David J. Moore, MBA: 25+ years as a loan officer, 2,000+ home loans closed, ex-Wells Fargo and JPMorgan Chase, author, and founder of YPN USA.",
  },
  book: {
    title: "AI Powered Real Estate by David J. Moore, MBA | YPN USA",
    description:
      "David J. Moore's Kindle guide to using AI in real estate and lending. $9.99, or free with Kindle Unlimited. Get it on Amazon.",
  },
  claimTerritory: {
    title: "Claim Your Exclusive ZIP Code | YPN USA",
    description:
      "Check if your ZIP code is open. One licensed loan officer per ZIP code; it locks when your first payment goes through. Free to check.",
  },
  consultation: {
    title: "Book a Strategy Call for Loan Officers & Teams | YPN USA",
    description:
      "Talk with David about your market, open ZIP codes and how Cerebro would work for you or your team. Pick a time that suits you.",
  },
  blog: {
    title: "Loan Officer Growth Blog: Leads, AI & Local SEO | YPN USA",
    description:
      "Practical guides for mortgage loan officers on leads, AI follow-up, local SEO, referral partners and marketing that works.",
  },
  gbpOptimizer: {
    title: "Free Google Business Profile Optimizer for Loan Officers",
    description:
      "Audit your Google Business Profile, get an optimized description, post ideas and local SEO steps built for mortgage loan officers. Free.",
  },
  socialWriter: {
    title: "Free AI Social Media Post Writer for Loan Officers",
    description:
      "Generate local social post drafts, hooks and calls to action for mortgage loan officers in seconds. Free to use.",
  },
  embed: {
    title: "Free Embeddable Tools for Loan Officers | YPN USA",
    description:
      "Add a free home equity calculator and an AI borrower intake assistant to your own site. Copy, paste, done. No coding needed.",
  },
} as const satisfies Record<string, PageSeo>;

/** Topic pillar titles and descriptions (same rules), keyed by cluster slug. */
export const TOPIC_SEO: Readonly<Record<string, PageSeo>> = {
  "exclusive-mortgage-leads": {
    title: "Exclusive Mortgage Leads by ZIP Code for Loan Officers",
    description:
      "Exclusive vs shared mortgage leads, what they really cost, and how owning a ZIP code lets loan officers keep local borrower demand.",
  },
  "ai-lead-automation": {
    title: "Mortgage CRM, AI Lead Capture & Automation | YPN USA",
    description:
      "Mortgage CRM and AI guides for loan officers: speed-to-lead, borrower intake, follow-up automation, and TCPA and RESPA compliance.",
  },
  "loan-officer-marketing": {
    title: "Loan Officer Marketing Strategy & Ideas | YPN USA",
    description:
      "Loan officer marketing strategy for 2026: local content, social media, video, email and referral partners, with free ideas to start today.",
  },
  "local-seo-for-loan-officers": {
    title: "SEO for Loan Officers & Mortgage Brokers | YPN USA",
    description:
      "Local SEO for loan officers: local pages, schema, Google Business Profile, site speed and showing up in AI search answers.",
  },
  "realtor-referral-partnerships": {
    title: "Realtor & Referral Partnerships for MLOs | YPN USA",
    description:
      "How loan officers build realtor co-marketing, attorney and past-client referral pipelines, with RESPA-aware plays and referral systems that compound.",
  },
  "loan-programs-and-niches": {
    title: "Mortgage Loan Programs & Niche Markets | YPN USA",
    description:
      "Marketing guides for FHA, VA, DSCR, jumbo, non-QM, HELOC, refinance, probate and first-time buyer niches, built for loan officers.",
  },
};

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
