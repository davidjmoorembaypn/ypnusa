import { COMPARISON_GUIDES, type GuideOption } from "@/content/comparison-guides";

/**
 * Head-to-head comparison pages at /compare/<slug>. Exactly three exist; do not add more without
 * real, sourced content.
 *
 * Every statement about another company comes from the matching entry in comparison-guides.ts,
 * where each claim has a source and a "checked" date. Nothing here adds a new claim about a
 * competitor: page copy written in this file only describes YPN USA or points at those entries.
 * Same writing rules as the guides: no em or en dashes, say "ZIP code", titles 60 characters or
 * fewer, descriptions 155 or fewer.
 */

export interface ComparePage {
  slug: string;
  path: string;
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  intro: string;
  /** Shown under the intro when the search term differs from the product's real name. */
  searchNote?: string;
  /** The guide whose sourced entries this page reads. */
  guideSlug: string;
  competitorId: string;
  datePublished: string;
  dateModified: string;
  faq: { q: string; a: string }[];
  related: { label: string; href: string }[];
}

const PUBLISHED = "2026-11-19";

const SHARED_FAQ = [
  {
    q: "Is YPN USA a lead marketplace?",
    a: "No. YPN USA provides marketing technology and ZIP code territories to licensed mortgage loan officers. It does not make loans, and it does not resell the same borrower inquiry to several loan officers. No results or lead volume are guaranteed.",
  },
  {
    q: "Does an exclusive ZIP code mean no other lender can market there?",
    a: "No. Exclusivity applies within YPN USA: each ZIP code goes to one YPN USA loan officer at a time, and borrower inquiries from YPN USA pages for that ZIP code route to that loan officer. Other lenders and marketplaces can still advertise in the same area.",
  },
  {
    q: "How do I check whether my ZIP code is open?",
    a: "Use the ZIP code checker on this page. Checking is free and does not reserve the ZIP code. It locks at your first payment on a paid plan.",
  },
];

export const COMPARE_PAGES: readonly ComparePage[] = [
  {
    slug: "lendingtree-vs-exclusive-zip-mortgage-leads",
    path: "/compare/lendingtree-vs-exclusive-zip-mortgage-leads",
    title: "LendingTree vs Exclusive ZIP code Mortgage Leads | YPN USA",
    description:
      "LendingTree's lender marketplace next to an exclusive ZIP code on YPN USA: where borrowers come from, whether you share them, price and who each one fits.",
    h1: "LendingTree vs exclusive ZIP code mortgage leads",
    eyebrow: "Marketplace leads vs one loan officer per ZIP code",
    intro:
      "A side-by-side look at LendingTree and YPN USA for licensed mortgage loan officers: where the borrowers come from, whether you share them, and what it costs. Every statement about LendingTree comes from the sources listed on this page, each checked on the date shown.",
    guideSlug: "zillow-alternatives-for-loan-officers",
    competitorId: "lendingtree",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    faq: SHARED_FAQ,
    related: [
      { label: "Zillow alternatives for loan officers (full roundup)", href: "/zillow-alternatives-for-loan-officers" },
      { label: "Exclusive mortgage leads explained", href: "/topics/exclusive-mortgage-leads" },
      { label: "All YPN USA comparisons", href: "/compare" },
    ],
  },
  {
    slug: "zillow-premier-lender-alternatives",
    path: "/compare/zillow-premier-lender-alternatives",
    title: "Zillow Premier Lender Alternatives | YPN USA",
    description:
      "Looking for a Zillow Premier Lender alternative? See Zillow's lender marketplace next to an exclusive ZIP code on YPN USA, with sources, price and fit.",
    h1: "Zillow Premier Lender alternatives: marketplace vs exclusive ZIP code",
    eyebrow: "Zillow lender advertising vs one loan officer per ZIP code",
    intro:
      "A side-by-side look at Zillow's lender marketplace and YPN USA for licensed mortgage loan officers: where the borrowers come from, whether you share them, and what it costs. Every statement about Zillow comes from the sources listed on this page, each checked on the date shown.",
    searchNote:
      "Loan officers often search for \"Zillow Premier Lender\". In its SEC filings, Zillow describes its lender advertising as Connect, its mortgage marketplace, sold on a cost per lead basis. This page compares that marketplace with an exclusive ZIP code. For more options, see the full roundup of Zillow alternatives.",
    guideSlug: "zillow-alternatives-for-loan-officers",
    competitorId: "zillow",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    faq: SHARED_FAQ,
    related: [
      { label: "Zillow alternatives for loan officers (full roundup)", href: "/zillow-alternatives-for-loan-officers" },
      { label: "LendingTree vs exclusive ZIP code mortgage leads", href: "/compare/lendingtree-vs-exclusive-zip-mortgage-leads" },
      { label: "All YPN USA comparisons", href: "/compare" },
    ],
  },
  {
    slug: "homebot-vs-cerebro-ai",
    path: "/compare/homebot-vs-cerebro-ai",
    title: "Homebot vs Cerebro AI for Loan Officers | YPN USA",
    description:
      "Homebot next to Cerebro, YPN USA's AI assistant for loan officers: what each one does, who it talks to, price and which loan officers each one fits.",
    h1: "Homebot vs Cerebro AI",
    eyebrow: "Two different jobs for a loan officer",
    intro:
      "A side-by-side look at Homebot and Cerebro, the AI assistant from YPN USA, for licensed mortgage loan officers: what each one does, who it talks to, and what it costs. Every statement about Homebot comes from the sources listed on this page, each checked on the date shown. Many loan officers use tools like these together, not one in place of the other.",
    guideSlug: "best-ai-assistants-for-loan-officers",
    competitorId: "homebot",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    faq: [
      {
        q: "Does Cerebro replace my CRM or my client-retention tool?",
        a: "No. Cerebro answers and qualifies borrowers on your YPN USA pages and helps you inside your dashboard. It assists you as the licensed loan officer and does not replace you or the other tools you rely on.",
      },
      SHARED_FAQ[1],
      SHARED_FAQ[2],
    ],
    related: [
      { label: "Best AI assistants for loan officers (full roundup)", href: "/best-ai-assistants-for-loan-officers" },
      { label: "YPN USA vs Homebot", href: "/vs/homebot" },
      { label: "What Cerebro does today", href: "/cerebro" },
    ],
  },
];

export function getComparePage(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((p) => p.slug === slug);
}

export interface ResolvedComparePage {
  page: ComparePage;
  competitor: GuideOption;
  ours: GuideOption;
  columns: { key: string; label: string }[];
}

/** Joins a page to its two sourced entries. Throws if either is missing, so a typo fails the build. */
export function resolveComparePage(page: ComparePage): ResolvedComparePage {
  const guide = COMPARISON_GUIDES.find((g) => g.slug === page.guideSlug);
  if (!guide) throw new Error(`compare page ${page.slug}: no guide ${page.guideSlug}`);
  const all = guide.baseline ? [guide.baseline, ...guide.options] : guide.options;
  const competitor = all.find((o) => o.id === page.competitorId && !o.isYpn);
  const ours = all.find((o) => o.isYpn);
  if (!competitor || !ours) throw new Error(`compare page ${page.slug}: missing option ${page.competitorId} or the YPN USA entry`);
  return { page, competitor, ours, columns: guide.columns };
}
