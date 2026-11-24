import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ZipLocalIntelSection } from "@/components/local-seo/zip-local-intel";
import { ZipTerritoryBanner } from "@/components/local-seo/zip-territory-banner";
import type { ZipLocalIntel } from "@/content/zip-local-intel";
import { CA_DRE_ID, NMLS_ID } from "@/lib/author";
import type { ZipDistance } from "@/lib/geo/zip-geo";
import { localIntakeHref, serializeJsonLd } from "@/lib/local-seo";
import { zipCanonicalUrl } from "@/lib/zip-index";
import { metroAreaForZip } from "@/lib/metro-area-zips";
import { metroAreaPath } from "@/content/metro-areas";

/**
 * ZIP code page for a ZIP code without a hand-written profile.
 *
 * Indexable ZIP codes (flagship or claimed) get the full local section, FAQs and neighbor links.
 * Every other ZIP code gets this short page with "noindex, follow" set in metadata: enough for a
 * visitor who lands on it, and nothing that invites crawlers deeper.
 */
export function ZipMarketPage({ intel, indexable, neighbors }: { intel: ZipLocalIntel; indexable: boolean; neighbors: ZipDistance[] }) {
  const { zip, city, state } = intel;
  const place = city && state ? `${city}, ${state}` : `ZIP code ${zip}`;
  const canonical = zipCanonicalUrl(zip);
  const metro = city && state ? metroAreaForZip({ city, state }) : undefined;
  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: `Mortgage help in ${place} ${zip}`,
    about: `${place} mortgage information`,
    inLanguage: "en-US",
  };

  return (
    <div className="min-h-full bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(webPage) }} />
      <SiteHeader />
      <main id="main-content">
        <section className="relative isolate overflow-hidden bg-[#09081b] text-white">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative mx-auto max-w-6xl px-6 py-14 lg:py-20">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "ZIP code territories", href: "/#territories" }, { name: zip }]} className="mb-6" />
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
              {place}
              {intel.county ? ` · ${intel.county}` : ""}
            </p>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold leading-tight lg:text-5xl">Mortgage help in {place} {zip}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/80">
              Tell us about the home and your timeline, and a licensed mortgage loan officer who serves ZIP code {zip} will follow up. No rate quote is given on
              this page, and starting is not an application or a commitment to lend.
            </p>
            <Link
              href={localIntakeHref({ kind: "zip", slug: zip })}
              className="mt-8 inline-flex min-h-[48px] items-center rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-[#09081b] shadow-lg shadow-amber-500/30 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Start with a few questions
            </Link>
          </div>
        </section>

        <ZipTerritoryBanner zip={zip} city={city} state={state} />

        {indexable ? (
          <div className="pt-14">
            <ZipLocalIntelSection intel={intel} neighbors={neighbors} />
          </div>
        ) : (
          <section className="mx-auto max-w-3xl px-6 py-12">
            <p className="leading-7 text-slate-700">
              Loan limits, property taxes and down payment programs differ by county, so a loan officer will confirm what applies to your property. Loan officers can{" "}
              <Link href={`/claim-territory?zip=${zip}`} className="font-semibold text-violet-700 underline">
                check whether ZIP code {zip} is open
              </Link>
              .
            </p>
          </section>
        )}

        {metro ? (
          <section className="mx-auto max-w-3xl px-6 pb-10">
            <p className="leading-7 text-slate-700">
              Loan officers: see the{" "}
              <Link href={metroAreaPath(metro)} className="font-semibold text-violet-700 underline">
                {metro.short} metro mortgage market data
              </Link>{" "}
              for loan counts, loan types and approval rates across the {metro.name} area.
            </p>
          </section>
        ) : null}

        <section className="mx-auto max-w-4xl px-6 pb-14">
          <p className="rounded-2xl bg-slate-50 p-5 text-xs leading-6 text-slate-600 ring-1 ring-slate-200">
            YPN USA (YPN Inc.) is a marketing technology platform for licensed mortgage loan officers. It is not a lender and does not make credit decisions.
            Nothing here is a rate quote, a loan estimate or a commitment to lend. David J. Moore, MBA &middot; NMLS #{NMLS_ID} &middot; CA DRE #{CA_DRE_ID}{" "}
            &middot; Equal Housing Opportunity.{" "}
            <Link href="/licensing-disclosures" className="underline">
              Licensing &amp; disclosures
            </Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
