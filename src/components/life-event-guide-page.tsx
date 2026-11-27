import Link from "next/link";
import { SiloNav } from "@/components/silo-nav";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { TrackedLink } from "@/components/tracked-link";
import { LIFE_EVENT_GUIDES, LIFE_EVENT_HUB_PATH, LIFE_EVENT_FUNNEL_SOURCE, LIFE_EVENT_INTAKE_HREF, LIFE_EVENT_REVIEWED_ON, lifeEventGuidePath, type LifeEventGuide } from "@/content/life-event-mortgages";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL, marketingUrl } from "@/lib/site";

/**
 * Body of a life-event mortgage guide (/mortgage-loans/life-events/after-divorce, ...). Emits
 * Article, FAQPage and BreadcrumbList JSON-LD. It names no author or reviewer; every FAQ and every source is also shown on the page.
 */
export function LifeEventGuidePage({ guide }: { guide: LifeEventGuide }) {
  const path = lifeEventGuidePath(guide);
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Mortgage Loans", href: "/mortgage-loans" },
    { name: "Life events", href: LIFE_EVENT_HUB_PATH },
    { name: guide.shortTitle, href: path },
  ];
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${marketingUrl(path)}#article`,
    headline: guide.title,
    description: guide.description,
    url: marketingUrl(path),
    datePublished: LIFE_EVENT_REVIEWED_ON,
    dateModified: LIFE_EVENT_REVIEWED_ON,
    inLanguage: "en-US",
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    citation: guide.sources.map((source) => source.url),
  };
  const others = LIFE_EVENT_GUIDES.filter((item) => item.slug !== guide.slug);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(guide.faqs)) }} />
      <Breadcrumbs items={breadcrumbItems} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">Mortgage guide</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{guide.title}</h1>
      <p className="mt-5 text-base leading-7 text-white/75">{guide.intro}</p>

      <section aria-labelledby="key-points" className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 id="key-points" className="text-lg font-semibold text-white">Key points</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
          {guide.keyPoints.map((point) => (
            <li key={point} className="flex gap-2">
              <span aria-hidden className="text-violet-300">&bull;</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {guide.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-3 text-sm leading-7 text-white/75">{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
              {section.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <span aria-hidden className="text-violet-300">&bull;</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-white">What to gather before you call a lender</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-white/75">
          {guide.documents.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-violet-300">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mt-10 text-xl font-semibold text-white">Common questions</h2>
      <div className="mt-4 space-y-3">
        {guide.faqs.map((item) => (
          <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer">
            <summary className="text-sm font-semibold text-white marker:content-none">{item.q}</summary>
            <p className="mt-2 text-sm leading-6 text-white/70">{item.a}</p>
          </details>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-violet-400/30 bg-violet-500/10 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">Talk it through with a licensed loan officer</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          The rules above are general. How they apply depends on your loan, your documents and your lender.
          Answer a few questions and a licensed loan officer will follow up. It is free and carries no obligation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <TrackedLink
            href={LIFE_EVENT_INTAKE_HREF}
            event="generate_lead_click"
            eventParams={{ source: LIFE_EVENT_FUNNEL_SOURCE }}
            className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-[#17152f] transition hover:bg-violet-100"
          >
            Start with a few questions
          </TrackedLink>
          <TrackedLink
            href="/pricing"
            event="pricing_click"
            eventParams={{ source: LIFE_EVENT_FUNNEL_SOURCE }}
            className="inline-flex rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Loan officer? See plans
          </TrackedLink>
        </div>
      </section>

      <section aria-labelledby="sources" className="mt-10">
        <h2 id="sources" className="text-lg font-semibold text-white">Sources</h2>
        <p className="mt-2 text-xs leading-5 text-white/60">
          Program rules change. These were checked on {LIFE_EVENT_REVIEWED_ON}; follow the links for the current text.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {guide.sources.map((source) => (
            <li key={source.url}>
              <a href={source.url} rel="noopener noreferrer" target="_blank" className="text-violet-300 underline hover:text-violet-200">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Other life-event guides" className="mt-10">
        <h2 className="text-lg font-semibold text-white">Other life-event guides</h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {others.map((item) => (
            <li key={item.slug}>
              <Link href={lifeEventGuidePath(item)} className="text-violet-300 underline hover:text-violet-200">{item.title}</Link>
            </li>
          ))}
          {guide.relatedPrograms.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-violet-300 underline hover:text-violet-200">{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* No "Written & Reviewed by" card yet: add AuthorReviewerCard once the founder has read the guide. */}

      <SiloNav silo="mortgage" currentPath={path} className="mt-10" />

      <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/65">
        Educational overview only, not legal or tax advice. Nothing on this page is a rate quote, an eligibility
        determination, or a commitment to lend. Talk to an attorney or tax professional about your own situation. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white">Licensing &amp; Disclosures</Link>{" "}
        for current licensing. Equal Housing Opportunity.
      </p>
    </div>
  );
}
