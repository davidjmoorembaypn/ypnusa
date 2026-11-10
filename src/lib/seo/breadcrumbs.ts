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
