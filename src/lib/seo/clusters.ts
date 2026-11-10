import type { BlogPost } from "@/content/blog";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { TOPIC_SEO } from "@/lib/seo/page-seo";

/**
 * SEO topic clusters (hub-and-spoke).
 *
 * Each cluster has one pillar page at /topics/<slug> that links to every post in
 * the cluster, and every post links back to its pillar plus its closest siblings.
 * That gives crawlers a shallow, consistent internal-link graph and concentrates
 * topical authority per keyword group instead of spreading it across ~170 flat posts.
 *
 * Assignment is deterministic and keyword-scored (title weighs 3x the description)
 * so new posts slot into a cluster without editing this file.
 */

export interface ClusterLink {
  label: string;
  href: string;
}

export interface TopicCluster {
  slug: string;
  /** Short label used in nav, breadcrumbs and "Part of" links. */
  name: string;
  /** Full pillar-page <title>, used as-is (≤ 60 chars); see TOPIC_SEO in page-seo.ts. */
  title: string;
  h1: string;
  /** Meta description, ≤ 155 chars. */
  description: string;
  intro: string[];
  /** Regex sources matched case-insensitively against title/description. */
  keywords: readonly string[];
  /** Product/landing pages that belong to the same topic; linked from the pillar. */
  pillarLinks: readonly ClusterLink[];
  faq: readonly { q: string; a: string }[];
}

export const TOPIC_CLUSTERS: readonly TopicCluster[] = [
  {
    slug: "exclusive-mortgage-leads",
    name: "Exclusive Mortgage Leads",
    title: TOPIC_SEO["exclusive-mortgage-leads"].title,
    h1: "Exclusive mortgage leads by ZIP code for loan officers",
    description: TOPIC_SEO["exclusive-mortgage-leads"].description,
    intro: [
      "Shared lead vendors sell the same borrower to several loan officers, so speed and price decide who wins, not service. This guide answers the questions loan officers ask most about exclusive mortgage leads: how they differ from shared leads, what they cost, how to judge a lead company, and how owning a ZIP code changes the math.",
    ],
    keywords: [
      "exclusive",
      "territor",
      "shared lead",
      "owned demand",
      "lead vendor",
      "lead cost",
      "lead channel",
      "lead generation compan",
      "trigger lead",
      "aged mortgage leads",
      "live transfer",
      "mortgage leads",
      "lead acquisition",
      "cost per acquisition",
      "zip code",
      "lead problems",
    ],
    pillarLinks: [
      { label: "Claim your ZIP code", href: "/claim-territory" },
      { label: "Check ZIP code demand", href: "/check-zip" },
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Loan officer markets", href: "/loan-officers" },
      { label: "Pricing", href: "/pricing" },
    ],
    faq: [
      {
        q: "What is an exclusive mortgage lead?",
        a: "An exclusive mortgage lead is a borrower inquiry delivered to one loan officer only, instead of being resold to several lenders. Because there is no race against other originators, follow-up quality matters more than who dials first.",
      },
      {
        q: "How does an exclusive ZIP code work?",
        a: "Each paid YPN USA plan includes one ZIP code. While you hold it, no other YPN USA loan officer can claim it, and inquiries from YPN USA pages for that ZIP code route to you rather than to a shared pool. It is exclusive within YPN USA, not across every lender. Checking a ZIP code is free.",
      },
    ],
  },
  {
    slug: "ai-lead-automation",
    name: "AI, Automation & Compliance",
    title: TOPIC_SEO["ai-lead-automation"].title,
    h1: "Mortgage CRM, AI lead capture and automation for loan officers",
    description: TOPIC_SEO["ai-lead-automation"].description,
    intro: [
      "Response time and consistent follow-up are the two levers loan officers control after a lead arrives. This guide covers the mortgage CRM, AI borrower intake, speed to lead, follow-up automation, and the TCPA and RESPA rules that keep it safe. It is educational, not legal advice.",
    ],
    keywords: [
      "\\bai\\b",
      "automat",
      "speed to lead",
      "speed-to-lead",
      "intake",
      "chatbot",
      "\\bcrm\\b",
      "webhook",
      "workflow",
      "drip",
      "nurture",
      "pre-qual",
      "pre-approval",
      "pre-screening",
      "calculator",
      "dashboard",
      "alerts?\\b",
      "reactivation",
      "follow-up",
      "tcpa",
      "respa",
      "compliance",
      "regulatory",
      "underwriting",
      "consent",
      "pipeline",
      "loan process",
    ],
    pillarLinks: [
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Mortgage CRM vs AI assistant", href: "/blog/mortgage-crm-vs-ai-assistant" },
      { label: "Platform features", href: "/features" },
      { label: "Claim your ZIP code", href: "/claim-territory" },
      { label: "Licensing disclosures", href: "/licensing-disclosures" },
    ],
    faq: [
      {
        q: "Do I need consent to text mortgage leads?",
        a: "Generally yes: marketing texts to a borrower require prior express written consent under the TCPA, and you must honor opt-outs. Confirm your exact process with qualified counsel.",
      },
      {
        q: "How fast should a loan officer respond to a mortgage lead?",
        a: "Faster is consistently better; responding within minutes, ideally under one minute for web inquiries, keeps the borrower engaged before they contact another lender. Automated intake and instant alerts make that practical.",
      },
      {
        q: "What can AI borrower intake do for a loan officer?",
        a: "It starts the conversation immediately, collects the details a loan officer needs for pre-qualification, and hands the borrower over with context, so the first human call is a conversation instead of a questionnaire.",
      },
    ],
  },
  {
    slug: "realtor-referral-partnerships",
    name: "Realtor & Referral Partnerships",
    title: TOPIC_SEO["realtor-referral-partnerships"].title,
    h1: "Realtor co-marketing and referral partnerships for loan officers",
    description: TOPIC_SEO["realtor-referral-partnerships"].description,
    intro: [
      "Referrals remain a core source of purchase and refinance volume, but relying on a handful of realtors concentrates risk. These guides cover compliant co-marketing, approaching agents, estate and probate attorney partnerships, and referral engines that do not depend on realtors at all.",
    ],
    keywords: [
      "realtor",
      "referral",
      "co-market",
      "co-brand",
      "co-op",
      "attorney",
      "partnership",
      "past client",
      "past-client",
      "review",
    ],
    pillarLinks: [
      { label: "MLO marketing", href: "/mlo-marketing" },
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Claim your ZIP code", href: "/claim-territory" },
      { label: "Book a call", href: "/consultation" },
    ],
    faq: [
      {
        q: "Is realtor co-marketing allowed for loan officers?",
        a: "Co-marketing is permitted when it follows RESPA: each party pays its fair share of the actual cost, and nothing of value is exchanged for referrals. Always confirm specifics with your compliance officer.",
      },
    ],
  },
  {
    slug: "local-seo-for-loan-officers",
    name: "Local SEO for Loan Officers",
    title: TOPIC_SEO["local-seo-for-loan-officers"].title,
    h1: "SEO for loan officers and mortgage brokers",
    description: TOPIC_SEO["local-seo-for-loan-officers"].description,
    intro: [
      "Organic search and map results are the lowest-cost long-term lead source a loan officer can build. This guide covers SEO for loan officers and mortgage brokers: Google Business Profile, local pages, schema, site speed and showing up in AI search answers.",
    ],
    keywords: [
      "\\bseo\\b",
      "schema",
      "google business",
      "google review",
      "\\bgeo\\b",
      "generative engine",
      "landing page",
      "hyper-local",
      "localized",
      "silo",
      "core web vitals",
      "site speed",
      "voice quer",
      "ai search",
      "organic",
      "digital asset",
      "lead magnet",
      "lead capture page",
      "technical seo",
      "market snapshot",
      "housing market data",
      "market intelligence",
      "central valley",
      "fresno",
      "phoenix",
    ],
    pillarLinks: [
      { label: "Google Business Profile optimizer", href: "/tools/gbp-optimizer" },
      { label: "Visalia loan officers", href: "/loan-officers/visalia-ca" },
      { label: "Loan officer markets", href: "/loan-officers" },
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Claim your ZIP code", href: "/claim-territory" },
    ],
    faq: [
      {
        q: "What makes a mortgage landing page rank locally?",
        a: "A unique page per market, a clear single topic, accurate local details, fast load times, structured data, and consistent business information that matches your Google Business Profile.",
      },
    ],
  },
  {
    slug: "loan-programs-and-niches",
    name: "Loan Programs & Niche Markets",
    title: TOPIC_SEO["loan-programs-and-niches"].title,
    h1: "Loan programs and niche borrower markets for loan officers",
    description: TOPIC_SEO["loan-programs-and-niches"].description,
    intro: [
      "Specializing in a product or borrower niche makes marketing cheaper and referrals easier. These guides cover FHA, VA, DSCR, jumbo, non-QM and bank-statement loans, HELOC and refinance strategy, and life-event niches such as probate and divorce.",
    ],
    keywords: [
      "non-qm",
      "\\bfha\\b",
      "va loan",
      "\\bdscr\\b",
      "jumbo",
      "heloc",
      "refinanc",
      "probate",
      "divorce",
      "first-time",
      "bank statement",
      "\\bdpa\\b",
      "down payment",
      "self-employed",
      "equity",
      "missing middle",
      "investor",
      "commercial",
      "foreclosure",
      "stay-put",
    ],
    pillarLinks: [
      { label: "Mortgage loan programs", href: "/mortgage-loans" },
      { label: "Loan types", href: "/loan-types" },
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Claim your ZIP code", href: "/claim-territory" },
    ],
    faq: [
      {
        q: "Which mortgage niche is best for a new loan officer?",
        a: "The best niche is one where you can reach a defined borrower group repeatedly, such as first-time buyers, veterans or self-employed borrowers, and where you hold enough product knowledge to be the obvious local expert.",
      },
    ],
  },
  {
    slug: "loan-officer-marketing",
    name: "Loan Officer Marketing",
    title: TOPIC_SEO["loan-officer-marketing"].title,
    h1: "Loan officer marketing strategy and ideas",
    description: TOPIC_SEO["loan-officer-marketing"].description,
    intro: [
      "Marketing that works for a loan officer is consistent, local and measurable. This guide lays out a loan officer marketing strategy for 2026, from local content and social media to email, referral partners and measuring what works.",
    ],
    keywords: [
      "marketing",
      "social media",
      "facebook",
      "instagram",
      "linkedin",
      "video",
      "personal brand",
      "text message",
      "email",
      "stand out",
      "new loan officer",
      "lead generation",
      "real estate leads",
      "strategies",
    ],
    pillarLinks: [
      { label: "27 free marketing ideas", href: "/blog/mortgage-marketing-ideas-for-loan-officers" },
      { label: "AI social post writer", href: "/tools/social-writer" },
      { label: "ROI calculator", href: "/roi" },
      { label: "Meet Cerebro", href: "/cerebro" },
      { label: "Claim your ZIP code", href: "/claim-territory" },
    ],
    faq: [
      {
        q: "How often should a loan officer post on social media?",
        a: "Consistency beats volume: a sustainable schedule of a few useful local posts a week outperforms bursts of daily posting that you cannot maintain.",
      },
    ],
  },
];

/** Cluster used when no keyword rule matches. */
const DEFAULT_CLUSTER_SLUG = "loan-officer-marketing";

const compiled = TOPIC_CLUSTERS.map((cluster) => ({
  cluster,
  rules: cluster.keywords.map((k) => new RegExp(k.startsWith("\\b") ? k : `\\b${k}`, "i")),
}));

export function getCluster(slug: string): TopicCluster | undefined {
  return TOPIC_CLUSTERS.find((c) => c.slug === slug);
}

/**
 * Posts that should not be indexed or listed: migrated stubs with no real body
 * (e.g. "External Image For post: 5"). Thin pages dilute site quality signals.
 */
export function isThinPost(post: Pick<BlogPost, "slug" | "title" | "html">): boolean {
  if (/^external-image-for-post/i.test(post.slug)) return true;
  const text = post.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length < 400;
}

export function scorePost(post: Pick<BlogPost, "title" | "description">, cluster: TopicCluster): number {
  const rules = compiled.find((c) => c.cluster.slug === cluster.slug)?.rules ?? [];
  let score = 0;
  for (const rule of rules) {
    if (rule.test(post.title)) score += 3;
    if (rule.test(post.description)) score += 1;
  }
  return score;
}

export function clusterForPost(post: Pick<BlogPost, "title" | "description">): TopicCluster {
  let best: TopicCluster | undefined;
  let bestScore = 0;
  for (const { cluster } of compiled) {
    const score = scorePost(post, cluster);
    // Strict ">" keeps declaration order as the tie-breaker.
    if (score > bestScore) {
      best = cluster;
      bestScore = score;
    }
  }
  return best ?? (getCluster(DEFAULT_CLUSTER_SLUG) as TopicCluster);
}

/** Indexable posts only, newest first. */
export const INDEXABLE_POSTS: readonly BlogPost[] = [...ALL_BLOG_POSTS]
  .filter((p) => !isThinPost(p))
  .sort((a, b) => (a.date < b.date ? 1 : -1));

const assignment = new Map<string, string>(
  INDEXABLE_POSTS.map((post) => [post.slug, post.cluster && getCluster(post.cluster) ? post.cluster : clusterForPost(post).slug]),
);

export function getPostCluster(slug: string): TopicCluster | undefined {
  const clusterSlug = assignment.get(slug);
  return clusterSlug ? getCluster(clusterSlug) : undefined;
}

export function getClusterPosts(clusterSlug: string): BlogPost[] {
  return INDEXABLE_POSTS.filter((p) => assignment.get(p.slug) === clusterSlug);
}

/**
 * Siblings for a post: same-cluster posts ranked by keyword overlap in the title,
 * topped up with the newest cluster posts, never including the post itself.
 */
export function getRelatedPosts(slug: string, limit = 5): BlogPost[] {
  const post = INDEXABLE_POSTS.find((p) => p.slug === slug);
  const clusterSlug = assignment.get(slug);
  if (!post || !clusterSlug) return [];
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    );
  const mine = words(post.title);
  return getClusterPosts(clusterSlug)
    .filter((p) => p.slug !== slug)
    .map((p) => {
      let overlap = 0;
      for (const w of words(p.title)) if (mine.has(w)) overlap += 1;
      return { p, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || (a.p.date < b.p.date ? 1 : -1))
    .slice(0, limit)
    .map((x) => x.p);
}
