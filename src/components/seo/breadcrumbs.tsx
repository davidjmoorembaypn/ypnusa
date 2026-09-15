import Link from "next/link";
import { appUrl } from "@/lib/site";

export type BreadcrumbItem = {
  name: string;
  /** Path relative to the app root, e.g. "/mortgage-loans/fha" */
  href: string;
};

/**
 * BreadcrumbList JSON-LD. Takes a flat item list so any silo can nest as
 * deep as its route requires without a separate component per level.
 */
export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: appUrl(item.href),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/** Visible breadcrumb trail paired with its JSON-LD twin. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <>
      <BreadcrumbSchema items={items} />
      <nav aria-label="Breadcrumb" className="text-xs text-white/50">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {isLast ? (
                  <span className="text-white/80" aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.href} className="transition hover:text-white">
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
