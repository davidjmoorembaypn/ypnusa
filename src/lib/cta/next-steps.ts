import { FREE_SIGNUP_HREF } from "@/lib/checkout";

/**
 * The one next step each page ends on, picked by what the reader came for. Guides about
 * leads and territory end at the ZIP code check, AI guides at Cerebro, local SEO at the
 * free Google Business Profile tool, website guides at the branded website, comparisons
 * and product pages at pricing. Each step has one primary action and at most one quiet
 * secondary link, so a page never ends in a dead end or a wall of buttons.
 */
export interface NextStepAction {
  label: string;
  href: string;
}

export interface NextStep {
  /** Short heading, phrased as the reader's next move. */
  heading: string;
  body: string;
  primary: NextStepAction;
  secondary?: NextStepAction;
  /** Show an inline ZIP code field that goes straight to the check on /claim-territory. */
  zipForm?: boolean;
}

const CHECK_ZIP: NextStepAction = { label: "Check my ZIP code", href: "/claim-territory" };
const START_FREE: NextStepAction = { label: "Start free, no card", href: FREE_SIGNUP_HREF };
const PRICING: NextStepAction = { label: "See plans and pricing", href: "/pricing" };
const CEREBRO: NextStepAction = { label: "Try Cerebro free", href: "/cerebro" };

export const ZIP_STEP: NextStep = {
  heading: "Lock your ZIP code before another loan officer does",
  body: "YPN USA gives each ZIP code to one loan officer. Once it's claimed, it's gone. Checking is free and takes seconds; the ZIP code locks when your first payment goes through.",
  primary: CHECK_ZIP,
  secondary: PRICING,
  zipForm: true,
};

const PRICING_STEP: NextStep = {
  heading: "Start free today, upgrade when you're ready",
  body: "The Free plan needs no card. Pro, Growth and Exclusive come with a 15-day free trial, Cerebro and one ZIP code that's yours alone within YPN USA.",
  primary: PRICING,
  secondary: START_FREE,
};

/** Keyed by topic cluster slug (src/lib/seo/clusters.ts). */
export const CLUSTER_NEXT_STEPS: Readonly<Record<string, NextStep>> = {
  "exclusive-mortgage-leads": ZIP_STEP,
  "ai-lead-automation": {
    heading: "Let Cerebro answer your next borrower",
    body: "Borrowers who wait go to whoever answers first. Cerebro answers day and night, qualifies them and hands the ready ones to you. Try it free, no card needed.",
    primary: CEREBRO,
    secondary: START_FREE,
  },
  "realtor-referral-partnerships": {
    heading: "Give your referral partners a lender who always answers",
    body: "Agents keep sending buyers to the loan officer who responds. Start free: Cerebro answers the buyers your partners send, any hour, and you get every conversation.",
    primary: START_FREE,
    secondary: CHECK_ZIP,
  },
  "local-seo-for-loan-officers": {
    heading: "See what your Google profile is missing",
    body: "Run the free optimizer: it reviews your Google Business Profile and drafts a description, posts and next steps written for loan officers. No Google login needed.",
    primary: { label: "Run the free optimizer", href: "/tools/gbp-optimizer" },
    secondary: CHECK_ZIP,
  },
  "loan-officer-websites": {
    heading: "Get a loan officer website that answers borrowers for you",
    body: "Your name and NMLS ID, local pages for your market, a compliance footer and Cerebro on every page, without hiring a designer.",
    primary: { label: "See the branded website", href: "/features/branded-mlo-website" },
    secondary: CHECK_ZIP,
  },
  "loan-programs-and-niches": ZIP_STEP,
  "loan-officer-marketing": {
    heading: "Start getting found in your market this week",
    body: "Start free: local pages, Cerebro answering borrowers and drafts for your posts. Upgrade when you want a ZIP code no other YPN USA loan officer can claim.",
    primary: START_FREE,
    secondary: { label: "Run the ROI calculator", href: "/roi" },
  },
};

/** Keyed by the route section of a page migrated from WordPress ("" for top-level pages). */
const SECTION_NEXT_STEPS: Readonly<Record<string, NextStep>> = {
  "/vs": PRICING_STEP,
  "/features": PRICING_STEP,
  "/platform": PRICING_STEP,
  "/loan-types": ZIP_STEP,
  "/markets": ZIP_STEP,
  "/territory": ZIP_STEP,
  "/agents": ZIP_STEP,
  "/mlo-marketing": CLUSTER_NEXT_STEPS["loan-officer-marketing"],
};

/** Top-level pages whose intent differs from the default ZIP code check. */
const PATH_NEXT_STEPS: Readonly<Record<string, NextStep>> = {
  "/compare": PRICING_STEP,
  "/how-it-works": PRICING_STEP,
  "/ypnus-vs-loanofficer-ai": PRICING_STEP,
  "/ypnus-vs-real-geeks": PRICING_STEP,
  "/predictive-lead-gen": CLUSTER_NEXT_STEPS["ai-lead-automation"],
  "/best-ai-mortgage-marketing-2026": CLUSTER_NEXT_STEPS["ai-lead-automation"],
  "/realtor-co-marketing": CLUSTER_NEXT_STEPS["realtor-referral-partnerships"],
  "/local-seo-strategies-for-mortgage-leads-in-2026": CLUSTER_NEXT_STEPS["local-seo-for-loan-officers"],
};

/** Pages that are not marketing pages and should not end in a sales step. */
const NO_STEP_PATHS: ReadonlySet<string> = new Set([
  "/contact",
  "/disclaimer",
  "/editorial-policy",
  "/research-methodology",
  "/refund-policy",
  "/cancellation-policy",
  "/doublescale-booking",
  "/doublescale-invoice",
  "/doublescale-proposal",
  "/doublescale-support-portal",
  "/client-portal",
  "/welcome",
  "/thank-you",
  "/checkout-cancel",
  "/terms",
  "/privacy",
]);

export function nextStepForCluster(clusterSlug: string | undefined): NextStep {
  return (clusterSlug && CLUSTER_NEXT_STEPS[clusterSlug]) || ZIP_STEP;
}

/** Next step for a migrated WordPress page at `path` inside `sectionPath`, or null for utility pages. */
export function nextStepForWpPage(sectionPath: string, path: string): NextStep | null {
  if (NO_STEP_PATHS.has(path)) return null;
  return PATH_NEXT_STEPS[path] ?? SECTION_NEXT_STEPS[sectionPath] ?? ZIP_STEP;
}
