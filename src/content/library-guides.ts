/**
 * Long-form guides that live outside /blog (pages migrated from the WordPress site).
 * Listed on /blog and on their topic pillar so each sits within two clicks of home and
 * inside its silo. `cluster` is a topic cluster slug (src/lib/seo/clusters.ts).
 */
export interface LibraryGuide {
  label: string;
  href: string;
  cluster: string;
}

export const LIBRARY_GUIDES: readonly LibraryGuide[] = [
  {
    label: "Mortgage lead generation for loan officers: the complete guide",
    href: "/mlo-marketing/mortgage-lead-generation-for-loan-officers-the-complete-guide",
    cluster: "exclusive-mortgage-leads",
  },
  { label: "AI mortgage follow-up", href: "/mlo-marketing/ai-mortgage-follow-up", cluster: "ai-lead-automation" },
  { label: "The 2026 AI mortgage marketing guide", href: "/best-ai-mortgage-marketing-2026", cluster: "ai-lead-automation" },
  { label: "Realtor co-marketing for loan officers", href: "/realtor-co-marketing", cluster: "realtor-referral-partnerships" },
  { label: "Realtor partnership strategy", href: "/mlo-marketing/realtor-partnership-strategy", cluster: "realtor-referral-partnerships" },
  { label: "Local SEO for loan officers", href: "/mlo-marketing/local-seo-for-loan-officers", cluster: "local-seo-for-loan-officers" },
  {
    label: "Local SEO strategies for mortgage leads in 2026",
    href: "/local-seo-strategies-for-mortgage-leads-in-2026",
    cluster: "local-seo-for-loan-officers",
  },
  {
    label: "2026 mortgage rate forecast and strategies for loan officers",
    href: "/2026-mortgage-rate-forecast-mlo-strategies",
    cluster: "loan-officer-marketing",
  },
  { label: "Mortgage marketing glossary", href: "/mlo-marketing/mortgage-marketing-glossary", cluster: "loan-officer-marketing" },
  { label: "All MLO marketing guides", href: "/mlo-marketing", cluster: "loan-officer-marketing" },
];

export function libraryGuidesFor(cluster: string): LibraryGuide[] {
  return LIBRARY_GUIDES.filter((g) => g.cluster === cluster);
}
