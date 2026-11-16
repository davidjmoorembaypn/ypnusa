import { BLOG_POSTS } from "@/content/blog";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { PROGRAM_LIST } from "@/lib/programs";
import { WP_FEATURES_SUBPAGES, WP_PLATFORM_PAGES } from "@/content/wp-import";

/**
 * Single source of truth for the site's topical silos. Every indexable page belongs to exactly one
 * silo, links up to its pillar, and sideways to its siblings (see components/silo-nav.tsx), so search
 * engines see tightly related clusters instead of a flat web of pages.
 *
 * Only INDEXED pages belong here. Noindexed placeholders (/ai-platform, /mortgage-loans/tools,
 * /real-estate-leads) are deliberately excluded so no link equity flows into pages Google drops.
 */
export type SiloId = "mortgage" | "growth";

export interface SiloLink {
  label: string;
  href: string;
  group: string;
}

export interface Silo {
  id: SiloId;
  name: string;
  pillar: { label: string; href: string };
  links: () => SiloLink[];
}

const MORTGAGE_LINKS = (): SiloLink[] => [
  ...PROGRAM_LIST.map((program) => ({
    label: PROGRAM_CONTENT[program].label,
    href: `/mortgage-loans/${program.toLowerCase()}`,
    group: "Loan programs",
  })),
  ...LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city").map((profile) => ({
    label: `Mortgage broker in ${profile.city}, ${profile.stateCode}`,
    href: getLocalSeoPath(profile),
    group: "Local mortgage help",
  })),
  { label: "Home Equity Snapshot", href: "/tools/equity", group: "Free tools" },
];

/** Migrated page titles carry a brand suffix or a sentence-long headline; nav links want a short label. */
const NAV_LABELS: Readonly<Record<string, string>> = {
  "Loan officer websites that capture leads while you close loans": "Loan officer websites",
  "A Digital Front Door for Every Borrower Conversation": "Borrower intake",
  "Lead Capture and Follow-Up That Works Alongside Your CRM": "Works with your CRM",
};
function navLabel(title: string): string {
  return NAV_LABELS[title] ?? title.replace(/\s*\|\s*YPN USA$/, "");
}

const GROWTH_LINKS = (): SiloLink[] => [
  { label: "Pricing", href: "/pricing", group: "Platform" },
  { label: "Cerebro AI assistant", href: "/cerebro", group: "Platform" },
  { label: "How it works", href: "/how-it-works", group: "Platform" },
  { label: "For teams", href: "/teams", group: "Platform" },
  { label: "Compare platforms", href: "/vs", group: "Platform" },
  ...WP_FEATURES_SUBPAGES.map((page) => ({ label: navLabel(page.title), href: `/features/${page.slug}`, group: "Feature details" })),
  ...WP_PLATFORM_PAGES.map((page) => ({ label: navLabel(page.title), href: `/platform/${page.slug}`, group: "Feature details" })),
  { label: "Free embeddable tools", href: "/embed", group: "Platform" },
  { label: "Google Business Profile Optimizer", href: "/tools/gbp-optimizer", group: "Free tools" },
  { label: "Social Media Marketing Writer", href: "/tools/social-writer", group: "Free tools" },
  ...BLOG_POSTS.map((post) => ({ label: post.title, href: `/blog/${post.slug}`, group: "Guides" })),
];

export const SILOS: Record<SiloId, Silo> = {
  mortgage: {
    id: "mortgage",
    name: "Mortgage loans",
    pillar: { label: "All mortgage loan programs", href: "/mortgage-loans" },
    links: MORTGAGE_LINKS,
  },
  growth: {
    id: "growth",
    name: "Loan officer growth platform",
    pillar: { label: "YPN USA features", href: "/features" },
    links: GROWTH_LINKS,
  },
};
