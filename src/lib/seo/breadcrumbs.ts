import { MARKETING_SITE_URL } from "@/lib/site";

export interface Crumb {
  /** Visible label. */
  name: string;
  /** Path on the marketing site ("/topics/loan-officer-marketing") or an absolute URL. */
  href: string;
}

function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href === "/" || href === "") return `${MARKETING_SITE_URL}/`;
  return `${MARKETING_SITE_URL}${href.startsWith("/") ? href : `/${href}`}`;
}

/**
 * schema.org BreadcrumbList for a trail like Home > Topics > Pillar > Post. Every item
 * carries an absolute URL on the canonical ypnus.com origin, the last one included, so
 * the list matches the visible trail rendered by <Breadcrumbs>.
 */
export function breadcrumbJsonLd(items: readonly Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.href),
    })),
  };
}

/** A trail that always starts at Home. */
export function homeTrail(...rest: Crumb[]): Crumb[] {
  return [{ name: "Home", href: "/" }, ...rest];
}

/** Home > Topics > {pillar} [> {post}] — the plan's trail for pillar pages and their posts. */
export function topicTrail(cluster: { slug: string; name: string }, post?: { slug: string; title: string }): Crumb[] {
  return homeTrail(
    { name: "Topics", href: "/topics" },
    { name: cluster.name, href: `/topics/${cluster.slug}` },
    ...(post ? [{ name: post.title, href: `/blog/${post.slug}` }] : []),
  );
}

/**
 * Hub each section of migrated WordPress pages hangs from. /platform pages describe features,
 * and the old /territory and /agents indexes now redirect, so those trails point at the page
 * that replaced them.
 */
const WP_SECTION_HUBS: Readonly<Record<string, Crumb>> = {
  "/vs": { name: "Compare", href: "/vs" },
  "/markets": { name: "Markets", href: "/markets" },
  "/loan-types": { name: "Lead types", href: "/loan-types" },
  "/features": { name: "Features", href: "/features" },
  "/platform": { name: "Features", href: "/features" },
  "/mlo-marketing": { name: "MLO marketing", href: "/mlo-marketing" },
  "/territory": { name: "Claim your ZIP code", href: "/claim-territory" },
  "/agents": { name: "Loan officers", href: "/loan-officers" },
};

/** Home > {section hub} > {page} for a migrated page; Home > {page} for top-level ones. */
export function wpPageTrail(sectionPath: string, path: string, title: string): Crumb[] {
  const hub = WP_SECTION_HUBS[sectionPath];
  return homeTrail(...(hub ? [hub] : []), { name: title, href: path });
}
