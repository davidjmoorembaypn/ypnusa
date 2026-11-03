import type { BlogPost } from "@/content/blog";
import { ALL_BLOG_POSTS } from "@/content/blog-all";

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
  /** Pillar-page <title> (the root template appends " | YPN USA"). Target ≤ 52 chars. */
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
    title: "Exclusive Mortgage Leads & ZIP Territories",
    h1: "Exclusive mortgage leads and ZIP territories for loan officers",
    description:
      "Compare exclusive vs shared mortgage leads, real cost per lead, and how an exclusive ZIP territory lets loan officers own borrower demand.",
    intro: [
      "Shared lead vendors sell the same borrower to several loan officers, so speed and price decide who wins, not service. These guides break down the real cost math of exclusive versus shared leads, how to evaluate lead sources, and how an exclusive ZIP territory changes the economics.",
      "Start with the guides below, then check whether the ZIP codes you serve are still available to claim.",
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
      { label: "Claim a ZIP territory", href: "/claim-territory" },
      { label: "Check ZIP demand", href: "/check-zip" },
      { label: "Pricing", href: "/pricing" },
      { label: "Territory pages", href: "/territory" },
    ],
    faq: [
      {
        q: "What is an exclusive mortgage lead?",
        a: "An exclusive mortgage lead is a borrower inquiry delivered to one loan officer only, instead of being resold to several lenders. Because there is no race against other originators, follow-up quality matters more than who dials first.",
      },
      {
        q: "How does an exclusive ZIP territory work?",
        a: "A ZIP territory reserves borrower demand in specific ZIP codes for one loan officer on the platform, so inquiries from those areas route to that officer rather than to a shared pool. Availability is checked per ZIP before you claim.",
      },
    ],
  },
  {
    slug: "ai-lead-automation",
    name: "AI, Automation & Compliance",
    title: "AI Lead Capture, Automation & Compliance",
    h1: "AI lead capture, automation and compliance for mortgage loan officers",
    description:
      "AI borrower intake, speed-to-lead, CRM workflows, SMS/email automation and TCPA/RESPA compliance guides for mortgage loan officers.",
    intro: [
      "Response time and consistent follow-up are the two levers loan officers control after a lead arrives. These guides cover AI borrower intake, speed-to-lead, CRM drip workflows, webhooks and the automation that keeps a pipeline moving without manual data entry. Compliance guides (TCPA consent, RESPA, audit readiness) are included because automation only scales safely when consent and disclosures are built in. They are educational, not legal advice.",
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
      { label: "AI platform", href: "/ai-platform" },
      { label: "Licensing disclosures", href: "/licensing-disclosures" },
      { label: "Platform features", href: "/features" },
      { label: "Book a demo", href: "/book" },
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
    title: "Realtor & Referral Partnerships for MLOs",
    h1: "Realtor co-marketing and referral partnerships for loan officers",
    description:
      "How loan officers build realtor co-marketing, attorney and past-client referral pipelines, with RESPA-aware plays and referral systems that compound.",
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
      { label: "Book a call", href: "/book" },
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
    title: "Local SEO & Content for Loan Officers",
    h1: "Local SEO, landing pages and content for loan officers",
    description:
      "Local SEO for mortgage websites: hyper-local landing pages, schema markup, Google Business Profile, Core Web Vitals and AI-search (GEO) strategy.",
    intro: [
      "Organic search and map results are the lowest-cost long-term lead source a loan officer can build. These guides cover hyper-local landing pages, schema markup, Google Business Profile, technical SEO audits, site speed and optimizing for AI answer engines.",
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
      { label: "Local markets", href: "/markets" },
      { label: "GBP optimizer tool", href: "/tools/gbp-optimizer" },
      { label: "Check ZIP demand", href: "/check-zip" },
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
    title: "Mortgage Loan Programs & Niche Markets",
    h1: "Loan programs and niche borrower markets for loan officers",
    description:
      "Marketing guides for FHA, VA, DSCR, jumbo, non-QM, HELOC, refinance, probate and first-time buyer niches, built for loan officers.",
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
    title: "Loan Officer Marketing Strategy & Social Media",
    h1: "Loan officer marketing strategy, social media and personal brand",
    description:
      "Loan officer marketing ideas for 2026: social media, Facebook, Instagram, LinkedIn, video, text and email, plus personal branding and lead generation.",
    intro: [
      "Marketing that works for a loan officer is consistent, local and measurable. These guides cover social media, video, email and text, personal branding and the broader lead-generation strategies that tie them together.",
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
      { label: "Social writer tool", href: "/tools/social-writer" },
      { label: "MLO marketing", href: "/mlo-marketing" },
      { label: "Pricing", href: "/pricing" },
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
  INDEXABLE_POSTS.map((post) => [post.slug, clusterForPost(post).slug]),
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
