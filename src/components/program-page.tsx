import Link from "next/link";
import { SiloNav } from "@/components/silo-nav";
import { AuthorReviewerCard } from "@/components/seo/author-reviewer-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { TrackedLink } from "@/components/tracked-link";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL, marketingUrl } from "@/lib/site";
import type { ProgramContent } from "@/content/mortgage-programs";

/**
 * Where a borrower goes to reach a loan officer: the intake form. Not /consultation, which is
 * the sales page for loan officers buying the platform. One source tag for every program page.
 */
export const BORROWER_INTAKE_HREF = "/embed/intake?funnelSource=mortgage-loans";

/**
 * Body of a loan program page (/mortgage-loans/fha, /mortgage-loans/bank-statement, ...).
 * Emits FinancialProduct, WebPage, FAQPage and BreadcrumbList JSON-LD; every FAQ is also
 * rendered visibly. `related` adds a short "Related" link list above the silo nav.
 */
export function ProgramPage({
  content,
  path,
  program,
  related = [],
}: {
  content: ProgramContent;
  path: string;
  /** Analytics label for CTA clicks, e.g. "DSCR" or "BANK_STATEMENT". */
  program: string;
  related?: ReadonlyArray<{ label: string; href: string }>;
}) {
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Mortgage Loans", href: "/mortgage-loans" },
    { name: content.label, href: path },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "@id": `${marketingUrl(path)}#product`,
    name: content.label,
    category: "MortgageLoan",
    url: marketingUrl(path),
    provider: { "@id": `${MARKETING_SITE_URL}/#organization` },
    description: content.summary,
  };
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${marketingUrl(path)}#webpage`,
    url: marketingUrl(path),
    name: content.label,
    description: content.summary,
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    about: { "@id": `${marketingUrl(path)}#product` },
    publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
    inLanguage: "en-US",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(content.faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(webPageJsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Loan program
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{content.label}</h1>
      <p className="mt-5 text-base leading-7 text-white/70">{content.intro}</p>

      <h2 className="mt-10 text-lg font-semibold text-white">Good fit for</h2>
      <ul className="mt-3 space-y-1.5 text-sm text-white/70">
        {content.idealFor.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-violet-300">
              &bull;
            </span>
            {item}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">Key features</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {content.keyFeatures.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <dt className="text-sm font-semibold text-white">{feature.title}</dt>
            <dd className="mt-1.5 text-[13px] leading-5 text-white/65">{feature.body}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-lg font-semibold text-white">Common questions</h2>
      <div className="mt-4 space-y-3">
        {content.faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer"
          >
            <summary className="text-sm font-semibold text-white marker:content-none">{item.q}</summary>
            <p className="mt-2 text-[13px] leading-5 text-white/65">{item.a}</p>
          </details>
        ))}
      </div>

      <section className="mt-12 rounded-3xl border border-violet-400/30 bg-violet-500/10 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-white">
          Talk through {content.label.toLowerCase()} with a licensed loan officer
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/70">
          Answer a few questions and a licensed loan officer will follow up on whether this program
          fits your situation. It is free and carries no obligation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <TrackedLink
            href={BORROWER_INTAKE_HREF}
            event="generate_lead_click"
            eventParams={{ source: "program_page", program }}
            className="inline-flex rounded-full bg-white px-6 py-3 text-sm font-bold text-[#17152f] transition hover:bg-violet-100"
          >
            Start with a few questions
          </TrackedLink>
          <TrackedLink
            href="/pricing"
            event="pricing_click"
            eventParams={{ source: "program_page", program }}
            className="inline-flex rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
          >
            Loan officer? See plans
          </TrackedLink>
        </div>
      </section>

      {related.length > 0 ? (
        <nav aria-label="Related pages" className="mt-10">
          <h2 className="text-lg font-semibold text-white">Related</h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {related.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-violet-300 underline hover:text-violet-200">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <AuthorReviewerCard path={path} pageName={content.label} pageId={`${marketingUrl(path)}#webpage`} tone="dark" className="mt-10" />

      <SiloNav silo="mortgage" currentPath={path} className="mt-10" />

      <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/65">
        Educational overview only. Nothing on this page is a rate quote, an eligibility
        determination, or a commitment to lend. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white">
          Licensing &amp; Disclosures
        </Link>{" "}
        for current licensing. Equal Housing Opportunity.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          All programs
        </Link>
        <Link href="/mortgage-loans/tools" className="text-violet-300 underline hover:text-violet-200">
          MLO portal tools
        </Link>
        <Link href={BORROWER_INTAKE_HREF} className="text-violet-300 underline hover:text-violet-200">
          Talk to a loan officer
        </Link>
      </div>
    </div>
  );
}
