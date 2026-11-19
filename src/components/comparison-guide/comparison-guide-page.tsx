import { AuthorReviewerCard } from "@/components/seo/author-reviewer-card";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { FOUNDER_ID, ORGANIZATION_ID, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { AUTHOR_NAME, NMLS_ID } from "@/lib/author";
import type { ComparisonGuide, GuideImage, GuideOption } from "@/content/comparison-guides";

/**
 * "Best X" / "X alternatives" guides for loan officers (src/content/comparison-guides.ts).
 * Built for search and AI answer engines: one H2 per option with a "best for" line, one
 * comparison table, a short FAQ (FAQPage JSON-LD), a WebPage + ItemList graph with the
 * author byline, and per-claim sources checked on a stated date.
 */

const AUTHOR_PATH = "/about-david-moore";

export function formatGuideDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Paths of a blog-library photo: 1200x675 WebP, 480px WebP and a 1200x630 JPEG for sharing. */
export function guidePhoto(image: GuideImage) {
  return {
    src: `/images/blog/${image.key}.webp`,
    srcSet: `/images/blog/${image.key}-480.webp 480w, /images/blog/${image.key}.webp 1200w`,
    og: `/images/blog/${image.key}-og.jpg`,
    width: 1200,
    height: 675,
    alt: image.alt,
  };
}

function GuidePhoto({ image, priority = false, className = "" }: { image: GuideImage; priority?: boolean; className?: string }) {
  const photo = guidePhoto(image);
  return (
    <figure className={className}>
      {/* Self-hosted blog-library photo with fixed dimensions, so nothing shifts while it loads. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        srcSet={photo.srcSet}
        sizes="(min-width: 1024px) 896px, 100vw"
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
        decoding="async"
        className="aspect-[16/9] w-full rounded-2xl bg-slate-100 object-cover shadow-sm"
      />
    </figure>
  );
}

function optionAnchor(option: GuideOption) {
  return `option-${option.id}`;
}

export function guideJsonLd(guide: ComparisonGuide, origin: string = MARKETING_SITE_URL) {
  const url = `${origin}${guide.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: guide.h1,
        headline: guide.h1,
        description: guide.description,
        inLanguage: "en-US",
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        lastReviewed: guide.dateModified,
        author: { "@type": "Person", "@id": FOUNDER_ID, name: AUTHOR_NAME, url: `${origin}${AUTHOR_PATH}` },
        reviewedBy: { "@id": FOUNDER_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@type": "WebSite", url: origin, name: "YPN USA" },
        about: guide.about.map((name) => ({ "@type": "Thing", name })),
        mainEntity: { "@id": `${url}#list` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: `${origin}${guidePhoto(guide.images.hero).src}`,
          width: 1200,
          height: 675,
          caption: guide.images.hero.alt,
        },
        image: `${origin}${guidePhoto(guide.images.hero).og}`,
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        name: guide.h1,
        numberOfItems: guide.options.length,
        itemListOrder: "https://schema.org/ItemListUnordered",
        itemListElement: guide.options.map((option, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: option.name,
          url: option.website.startsWith("/") ? `${origin}${option.website}` : option.website,
          description: `${option.category}. Best for: ${option.bestFor}`,
        })),
      },
    ],
  };
}

function OptionSection({ option, heading }: { option: GuideOption; heading: string }) {
  return (
    <section id={optionAnchor(option)} className="scroll-mt-24 border-t border-slate-200 pt-10">
      <h2 className="text-2xl font-semibold tracking-tight text-[#13254a]">{heading}</h2>
      <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-amber-800">{option.category}</p>
      <p className="mt-4 leading-7 text-slate-700">{option.summary}</p>
      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <dt className="font-semibold text-emerald-900">Best for</dt>
          <dd className="mt-1 leading-6 text-slate-800">{option.bestFor}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt className="font-semibold text-slate-900">Look elsewhere if</dt>
          <dd className="mt-1 leading-6 text-slate-800">{option.notFor}</dd>
        </div>
      </dl>
      <h3 className="mt-6 text-base font-semibold text-slate-900">What it includes</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-7 text-slate-700">
        {option.highlights.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-4 leading-7 text-slate-700">
        <strong className="font-semibold text-slate-900">Pricing: </strong>
        {option.pricing}
      </p>
      {option.isYpn ? (
        <p className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/pricing" className="inline-flex rounded-full bg-amber-400 px-5 py-2.5 font-semibold text-[#09081b]">
            See YPN USA pricing
          </Link>
          <a href="#zip-check" className="inline-flex rounded-full border border-slate-300 px-5 py-2.5 font-semibold text-[#13254a]">
            Check your ZIP code
          </a>
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Source{option.sources.length > 1 ? "s" : ""}:{" "}
        {option.sources.map((source, i) => (
          <span key={source.url}>
            {i > 0 ? "; " : ""}
            {source.url.startsWith("/") ? (
              <Link href={source.url} className="underline">
                {source.label}
              </Link>
            ) : (
              <a href={source.url} rel="nofollow noopener" target="_blank" className="underline">
                {source.label}
              </a>
            )}
            , checked {formatGuideDate(source.checked)}
          </span>
        ))}
        .
      </p>
    </section>
  );
}

export function ComparisonGuidePage({ guide, origin = MARKETING_SITE_URL }: { guide: ComparisonGuide; origin?: string }) {
  const crumbs = homeTrail({ name: "Compare", href: "/compare" }, { name: guide.breadcrumb, href: guide.path });
  const everyOption = guide.baseline ? [guide.baseline, ...guide.options] : guide.options;
  const allSources = everyOption.flatMap((option) => option.sources).filter((s, i, list) => list.findIndex((x) => x.url === s.url) === i);
  const trademarkNames = [...new Set(everyOption.filter((option) => !option.isYpn).map((option) => option.trademarkName ?? option.name))];

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(guideJsonLd(guide, origin)) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(guide.faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={crumbs} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">{guide.eyebrow}</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">{guide.h1}</h1>
            <p className="mt-5 text-lg leading-relaxed text-slate-700">{guide.intro}</p>
            <GuidePhoto image={guide.images.hero} priority className="mt-8" />
            <p className="mt-5 text-sm text-slate-600">
              By{" "}
              <Link href={AUTHOR_PATH} rel="author" className="font-semibold text-[#13254a] underline">
                {AUTHOR_NAME}
              </Link>
              , NMLS #{NMLS_ID} · Updated <time dateTime={guide.dateModified}>{formatGuideDate(guide.dateModified)}</time>
            </p>
            <p className="mt-2 text-sm text-slate-600">
              YPN Inc. publishes this page and sells YPN USA, one of the options below. Facts about other products come from their own
              websites, linked under each option. Read{" "}
              <Link href="/research-methodology" className="underline">
                how we compare tools
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="py-10">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">The short answer</h2>
            <ul className="mt-4 space-y-3">
              {guide.shortAnswer.map((line) => (
                <li key={line} className="rounded-xl border border-slate-200 p-4 leading-7 text-slate-800">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pb-10">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Comparison table</h2>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[820px] text-left text-sm">
                <caption className="sr-only">{guide.tableCaption}</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Option</th>
                    {guide.columns.map((column) => (
                      <th key={column.key} scope="col" className="px-4 py-3">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(guide.baseline ? [guide.baseline, ...guide.options] : guide.options).map((option) => (
                    <tr key={option.id} className={`border-b border-slate-100 align-top last:border-0 ${option.isYpn ? "bg-amber-50/60" : ""}`}>
                      <th scope="row" className="px-4 py-3 font-semibold">
                        <a href={`#${optionAnchor(option)}`} className="text-[#13254a] underline">
                          {option.name}
                        </a>
                      </th>
                      {guide.columns.map((column) => (
                        <td key={column.key} className="px-4 py-3 leading-6 text-slate-700">
                          {option.table[column.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Prices and features as published on each company&rsquo;s website on {formatGuideDate(guide.dateModified)}. They change, so
              confirm on the company&rsquo;s site before you buy.
            </p>
          </div>
        </section>

        <div className="mx-auto w-full max-w-4xl space-y-10 px-4 pb-12 sm:px-6">
          {guide.images.inline[0] ? <GuidePhoto image={guide.images.inline[0]} /> : null}
          {guide.baseline ? <OptionSection option={guide.baseline} heading={`First, what ${guide.baseline.trademarkName ?? guide.baseline.name} offers`} /> : null}
          {guide.options.map((option, index) => (
            <OptionSection key={option.id} option={option} heading={`${index + 1}. ${option.name}`} />
          ))}
        </div>

        <section className="border-t border-slate-200 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            {guide.images.inline[1] ? <GuidePhoto image={guide.images.inline[1]} className="mb-8" /> : null}
            <h2 className="text-2xl font-semibold text-[#13254a]">How to choose</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-700">
              {guide.howToChoose.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-slate-50 py-12">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[#13254a]">See if your ZIP code is open</h2>
              <p className="mt-3 text-slate-700">
                YPN USA has a free plan with Cerebro and the AI borrower intake assistant, no card needed. Paid plans start at $99 a month
                and each includes one ZIP code that no other YPN USA loan officer can claim. Checking is free and does not reserve the
                ZIP code.
              </p>
              <p className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-[#13254a]">
                <Link href="/pricing" className="underline">
                  Compare plans on the pricing page
                </Link>
                <Link href="/check-zip" className="underline">
                  See local demand for your ZIP code
                </Link>
                <Link href="/cerebro" className="underline">
                  What Cerebro does today
                </Link>
              </p>
            </div>
            <div id="zip-check" className="scroll-mt-24 rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source={`comparison_guide:${guide.slug}`} />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Frequently asked questions</h2>
            <div className="mt-4 space-y-3">
              {guide.faq.map((item) => (
                <details key={item.q} className="rounded-xl border border-slate-200 p-4" open>
                  <summary className="cursor-pointer font-semibold text-slate-900">{item.q}</summary>
                  <p className="mt-2 leading-7 text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Sources and method</h2>
            <p className="mt-3">{guide.method}</p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5">
              {allSources.map((source) => (
                <li key={source.url}>
                  {source.url.startsWith("/") ? (
                    <Link href={source.url} className="underline">
                      {source.label}
                    </Link>
                  ) : (
                    <a href={source.url} rel="nofollow noopener" target="_blank" className="underline">
                      {source.label}
                    </a>
                  )}
                  , checked {formatGuideDate(source.checked)}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              {trademarkNames.join(", ")} {trademarkNames.length > 1 ? "are trademarks of their owners" : "is a trademark of its owner"}, used
              here only to identify the products. YPN Inc. is not affiliated with them and received nothing to be listed. Spotted an
              error? Email <a href="mailto:support@ypnus.com" className="underline">support@ypnus.com</a> and we will correct it. Read our{" "}
              <Link href="/editorial-policy" className="underline">
                editorial policy
              </Link>
              .
            </p>
            <nav aria-label="More comparisons" className="mt-8">
              <h2 className="text-lg font-semibold text-[#13254a]">More comparisons</h2>
              <ul className="mt-3 flex flex-wrap gap-3">
                {guide.related.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 font-semibold text-[#13254a] hover:bg-slate-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </section>
        <div className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6">
          <AuthorReviewerCard path={guide.path} pageName={guide.title} pageId={`${origin}${guide.path}#webpage`} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
