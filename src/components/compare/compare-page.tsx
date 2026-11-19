import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { AuthorReviewerCard } from "@/components/seo/author-reviewer-card";
import type { GuideOption } from "@/content/comparison-guides";
import type { ResolvedComparePage } from "@/content/compare-pages";
import { CA_DRE_ID, NMLS_ID } from "@/lib/author";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { FOUNDER_ID, ORGANIZATION_ID, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

const H2 = "text-2xl font-semibold text-[#13254a] lg:text-3xl";

function OptionCard({ option }: { option: GuideOption }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">{option.category}</p>
      <h3 className="mt-1 text-xl font-semibold text-[#13254a]">{option.name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{option.summary}</p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {option.highlights.map((h) => (
          <li key={h} className="flex gap-2">
            <span aria-hidden className="text-amber-700">
              &bull;
            </span>
            {h}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-slate-700">
        <span className="font-semibold text-[#13254a]">Price: </span>
        {option.pricing}
      </p>
    </article>
  );
}

/** Head-to-head comparison page. All copy about the other company comes from its sourced guide entry. */
export function ComparePageView({ resolved }: { resolved: ResolvedComparePage }) {
  const { page, competitor, ours, columns } = resolved;
  const url = `${MARKETING_SITE_URL}${page.path}`;
  const theirName = competitor.trademarkName ?? competitor.name;
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: page.h1,
    description: page.description,
    url,
    mainEntityOfPage: url,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    inLanguage: "en-US",
    author: { "@id": FOUNDER_ID },
    reviewedBy: { "@id": FOUNDER_ID },
    publisher: { "@id": ORGANIZATION_ID },
    about: [competitor.name, ours.name],
    audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
  };
  const sources = [...competitor.sources, ...ours.sources];

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(page.faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={homeTrail({ name: "Compare", href: "/compare" }, { name: page.h1, href: page.path })} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">{page.eyebrow}</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">{page.h1}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">{page.intro}</p>
            {page.searchNote ? <p className="mt-4 max-w-3xl rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">{page.searchNote}</p> : null}
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className={H2}>Side by side</h2>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">
                  {theirName} compared with {ours.name}
                </caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">
                      Compared on
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {theirName}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {ours.name}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((column) => (
                    <tr key={column.key} className="border-t border-slate-200 align-top">
                      <th scope="row" className="px-4 py-3 font-semibold text-[#13254a]">
                        {column.label}
                      </th>
                      <td className="px-4 py-3 text-slate-700">{competitor.table[column.key]}</td>
                      <td className="px-4 py-3 text-slate-700">{ours.table[column.key]}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 align-top">
                    <th scope="row" className="px-4 py-3 font-semibold text-[#13254a]">
                      Exclusivity
                    </th>
                    <td className="px-4 py-3 text-slate-700">See &ldquo;{theirName}&rdquo; below and its sources. We state only what its own material says.</td>
                    <td className="px-4 py-3 text-slate-700">One YPN USA loan officer per ZIP code. Exclusivity applies within YPN USA.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <OptionCard option={competitor} />
              <OptionCard option={ours} />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className={H2}>Who should choose which</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {[competitor, ours].map((option) => (
                <div key={option.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-[#13254a]">Choose {option.trademarkName ?? option.name} if</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{option.bestFor}</p>
                  <h4 className="mt-4 text-sm font-semibold text-[#13254a]">Look elsewhere if</h4>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{option.notFor}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-700">The two are not mutually exclusive: nothing stops a loan officer from using both.</p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className={H2}>Is your ZIP code open?</h2>
              <p className="mt-3 text-slate-700">
                Each ZIP code goes to one YPN USA loan officer. Checking is free and takes a few seconds. It does not reserve the ZIP code, which locks at your first
                payment on a paid plan.
              </p>
              <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
                <Link href="/pricing" className="underline">
                  See plans
                </Link>
                <Link href="/cerebro" className="underline">
                  What Cerebro does
                </Link>
              </p>
            </div>
            <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source={`compare_${page.slug}`} />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <h2 className={H2}>FAQ</h2>
            <div className="mt-6 space-y-3">
              {page.faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
            <h2 className={H2}>Sources and disclosures</h2>
            <ul className="mt-4 space-y-1">
              {sources.map((s) => (
                <li key={`${s.label}-${s.url}`}>
                  {s.url.startsWith("/") ? (
                    <Link href={s.url} className="font-semibold text-[#13254a] underline">
                      {s.label}
                    </Link>
                  ) : (
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-[#13254a] underline">
                      {s.label}
                    </a>
                  )}{" "}
                  <span className="text-slate-600">(checked {s.checked})</span>
                </li>
              ))}
            </ul>
            <p className="mt-6">
              {theirName} is a trademark of its owner, used here only to identify the product. YPN Inc. is not affiliated with it and received nothing to publish this
              comparison. Products and prices change, so confirm details with each company. Spotted an error? Email support@ypnus.com and we will fix it.
            </p>
            <p className="mt-3">
              YPN USA is a marketing technology platform for licensed mortgage loan officers. It is not a lender, does not make credit decisions and does not quote
              rates. Nothing on this page is a promise of leads or loans, or a commitment to lend. David J. Moore, MBA &middot; NMLS #{NMLS_ID} &middot; CA DRE #
              {CA_DRE_ID} &middot; Equal Housing Opportunity.
            </p>
            <nav aria-label="Related comparisons" className="mt-6">
              <ul className="flex flex-wrap gap-3">
                {page.related.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                      {r.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <AuthorReviewerCard path={page.path} pageName={page.h1} className="mt-8" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
