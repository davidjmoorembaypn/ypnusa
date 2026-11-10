import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { WP_AUTHOR, type WpImportedPage } from "@/content/wp-import";
import { FOUNDER_ID, faqJsonLd, jsonLdScript, softwareApplicationJsonLd } from "@/lib/seo";
import { NMLS_CONSUMER_ACCESS_URL, NMLS_ID, CA_DRE_ID } from "@/lib/author";
import { needsFullPageLoad, prepareWpHtml } from "@/lib/wp-html";

/**
 * Renders a page migrated from ypnus.com's WordPress (see
 * src/content/wp-import/index.ts). Most are self-contained landing pages that
 * bring their own <style> block scoped to a wrapper id/class, so they're dropped
 * in as-is. Pages from the ypnus.com rebuild without their own design
 * (`showTitle`: comparisons, editorial policy, methodology) get the blog's prose
 * layout and a rendered <h1>.
 */

/** Same typography as blog posts (src/app/blog/[slug]/page.tsx), plus the rebuild's ypx-* helpers. */
const PROSE = `space-y-6 text-[15px] leading-7 text-slate-700
  [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-slate-900
  [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-900
  [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5
  [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5
  [&_a]:text-violet-700 [&_a]:font-semibold [&_a]:underline [&_a:hover]:text-violet-900
  [&_strong]:font-semibold [&_strong]:text-slate-900
  [&_table]:w-full [&_table]:my-8 [&_table]:border-collapse [&_table]:border [&_table]:border-slate-200 [&_table]:text-sm
  [&_thead]:bg-slate-50
  [&_th]:border [&_th]:border-slate-200 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-slate-900
  [&_td]:border [&_td]:border-slate-200 [&_td]:px-4 [&_td]:py-2.5 [&_td]:align-top
  [&_.ypx-lead]:text-lg [&_.ypx-lead]:text-slate-800
  [&_.ypx-meta]:text-xs [&_.ypx-meta]:text-slate-500
  [&_.ypx-btn]:inline-flex [&_.ypx-btn]:rounded-full [&_.ypx-btn]:bg-amber-400 [&_.ypx-btn]:px-6 [&_.ypx-btn]:py-3 [&_.ypx-btn]:text-sm [&_.ypx-btn]:text-[#09081b] [&_.ypx-btn]:no-underline
  [&_.ypx-btn-ghost]:bg-transparent [&_.ypx-btn-ghost]:border [&_.ypx-btn-ghost]:border-violet-300 [&_.ypx-btn-ghost]:text-violet-800`;

function absolute(origin: string, href: string) {
  return /^https?:/.test(href) ? href : `${origin}${href}`;
}

function personJsonLd(origin: string) {
  const a = WP_AUTHOR;
  const alumni = typeof a.alumniOf === "string" ? { name: a.alumniOf } : a.alumniOf;
  return {
    "@type": "Person",
    // One founder entity site-wide: the root layout's Person node.
    "@id": FOUNDER_ID,
    name: a.name,
    jobTitle: a.jobTitle,
    url: absolute(origin, a.url),
    description: a.bio,
    ...(a.knowsAbout.length ? { knowsAbout: a.knowsAbout } : {}),
    ...(a.sameAs.length ? { sameAs: a.sameAs } : {}),
    ...(alumni ? { alumniOf: { "@type": "CollegeOrUniversity", ...alumni } } : {}),
    hasCredential: a.credentials.map((c) => ({
      "@type": "EducationalOccupationalCredential",
      name: c.name,
      credentialCategory: c.category,
      ...(c.identifier ? { identifier: c.identifier } : {}),
      ...(c.recognizedBy
        ? { recognizedBy: { "@type": "Organization", name: c.recognizedBy, ...(c.recognizedByUrl ? { url: c.recognizedByUrl } : {}) } }
        : {}),
    })),
  };
}

function pageJsonLd(page: WpImportedPage, url: string, origin: string) {
  const graph: Record<string, unknown>[] = [];
  const person = page.authorBox ? personJsonLd(origin) : null;
  if (person) graph.push(person);
  graph.push({
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    ...(page.modified ? { dateModified: page.modified } : {}),
    ...(person ? { author: { "@id": person["@id"] }, reviewedBy: { "@id": person["@id"] } } : {}),
    ...(page.reviewedDate ? { lastReviewed: page.reviewedDate } : {}),
  });
  if (page.schemaType === "Article") {
    graph.push({
      "@type": "Article",
      "@id": `${url}#article`,
      headline: page.title,
      description: page.description,
      mainEntityOfPage: { "@id": `${url}#webpage` },
      ...(page.date ? { datePublished: page.date } : {}),
      ...(page.modified ? { dateModified: page.modified } : {}),
      ...(person ? { author: { "@id": person["@id"] } } : {}),
      publisher: { "@type": "Organization", name: "YPN USA", url: origin },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function itemListJsonLd(items: { name: string; href: string }[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${origin}${item.href}`,
    })),
  };
}

function formatReviewed(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function AuthorBox({ reviewedDate }: { reviewedDate?: string }) {
  const a = WP_AUTHOR;
  return (
    <aside aria-label="About the author" className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">
        <Link href={a.url} rel="author" className="text-violet-700 hover:underline">
          {a.name}
        </Link>{" "}
        · {a.jobTitle}
      </p>
      <p className="mt-2 leading-6">{a.bio}</p>
      <p className="mt-2 text-xs text-slate-500">
        NMLS #{NMLS_ID} (
        <a href={NMLS_CONSUMER_ACCESS_URL} target="_blank" rel="noopener" className="underline">
          verify
        </a>
        ) · CA DRE #{CA_DRE_ID} · MBA
        {reviewedDate ? (
          <>
            {" "}
            · Reviewed <time dateTime={reviewedDate}>{formatReviewed(reviewedDate)}</time>
          </>
        ) : null}{" "}
        ·{" "}
        <Link href={a.editorialPolicyUrl} className="underline">
          Editorial policy
        </Link>
      </p>
    </aside>
  );
}

export function WpImportedPageView({
  page,
  path,
  breadcrumbLabel,
  origin,
}: {
  page: WpImportedPage;
  path: string;
  breadcrumbLabel: string;
  /** Protocol + host that served this request, for absolute schema URLs. */
  origin: string;
}) {
  const url = `${origin}${path}`;
  // A page that already renders its own author block keeps it; only add ours when missing.
  const wantAuthor = page.authorBox && !page.html.includes("ypx-author");
  const related = page.related ?? [];
  // Normalized links/assets, and exactly one <h1> on the page.
  const body = prepareWpHtml(page.html, Boolean(page.showTitle));
  return (
    <div className="flex min-h-full flex-col bg-white text-slate-900">
      <SiteHeader />
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: breadcrumbLabel, href: path },
          { name: page.title, href: path },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd(page, url, origin)).replace(/</g, "\\u003c") }}
      />
      {page.softwareApp ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareApplicationJsonLd()) }} />
      ) : null}
      {page.itemList?.length ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd(page.itemList, origin)) }} />
      ) : null}
      {page.faq?.length ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(page.faq)).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <main id="main-content" className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-6 pt-4">
          <Link href="/" className="text-sm font-semibold text-violet-700 hover:underline">
            ← Back home
          </Link>
        </div>
        {page.showTitle ? (
          <article className="mx-auto w-full max-w-3xl px-6 py-10">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{page.title}</h1>
            <div className={`mt-8 ${PROSE}`} dangerouslySetInnerHTML={{ __html: body.html }} />
          </article>
        ) : (
          <>
            {body.needsTitleH1 ? (
              <div className="mx-auto w-full max-w-3xl px-6 pt-6">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{page.title}</h1>
              </div>
            ) : null}
            <div dangerouslySetInnerHTML={{ __html: body.html }} />
          </>
        )}
        {related.length || wantAuthor ? (
          <div className="mx-auto w-full max-w-3xl px-6 pb-12">
            {related.length ? (
              <nav aria-label="Related pages" className="mt-10">
                <h2 className="text-xl font-semibold text-slate-900">Keep exploring</h2>
                <ul className="mt-3 space-y-2">
                  {related.map((l) => (
                    <li key={l.href}>
                      {needsFullPageLoad(l.href) ? (
                        // Interactive imported page: its inline scripts only run on a full load.
                        <a href={l.href} className="font-semibold text-violet-700 hover:underline">
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className="font-semibold text-violet-700 hover:underline">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
            {wantAuthor ? <AuthorBox reviewedDate={page.reviewedDate} /> : null}
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
