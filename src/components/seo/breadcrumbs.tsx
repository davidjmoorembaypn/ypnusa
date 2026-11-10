import Link from "next/link";
import { breadcrumbJsonLd, type Crumb } from "@/lib/seo/breadcrumbs";

export type BreadcrumbItem = Crumb;

/**
 * BreadcrumbList JSON-LD. Takes a flat item list so any silo can nest as
 * deep as its route requires without a separate component per level.
 */
export function BreadcrumbSchema({ items }: { items: readonly BreadcrumbItem[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(items)).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * Visible breadcrumb trail paired with its JSON-LD twin. `tone` picks colors that keep
 * at least 4.5:1 contrast on the dark (#09081b) or light (white/slate-50) sections.
 */
export function Breadcrumbs({
  items,
  tone = "dark",
  className = "",
}: {
  items: readonly BreadcrumbItem[];
  tone?: "dark" | "light";
  className?: string;
}) {
  const base = tone === "dark" ? "text-white/70" : "text-slate-600";
  const current = tone === "dark" ? "text-white/90" : "text-slate-900";
  const hover = tone === "dark" ? "hover:text-white" : "hover:text-slate-900";
  return (
    <>
      <BreadcrumbSchema items={items} />
      <nav aria-label="Breadcrumb" className={`text-xs ${base} ${className}`}>
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {isLast ? (
                  <span className={current} aria-current="page">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.href} className={`underline-offset-2 transition hover:underline ${hover}`}>
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
