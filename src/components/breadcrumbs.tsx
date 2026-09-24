import Link from "next/link";
import { serializeJsonLd } from "@/lib/local-seo";
import { APP_SITE_URL } from "@/lib/site";

export interface BreadcrumbItem {
  /** Visible label. */
  name: string;
  /** Omit on the last item — it renders as the current page, not a link. */
  href?: string;
}

/**
 * Accessible breadcrumb nav + matching BreadcrumbList JSON-LD. Styled for the
 * dark hero sections this app already uses (site-header.tsx, the local-seo
 * hero, tools/equity) — pass `className` to adjust spacing/placement per page.
 */
export function Breadcrumbs({
  items,
  className = "",
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: `${APP_SITE_URL}${item.href}` } : {}),
    })),
  };

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-white/60">
        {items.map((item, index) => (
          <li key={item.name} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden className="text-white/30">
                /
              </span>
            ) : null}
            {item.href ? (
              <Link href={item.href} className="transition hover:text-white">
                {item.name}
              </Link>
            ) : (
              <span aria-current={index === items.length - 1 ? "page" : undefined} className="text-white/85">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
