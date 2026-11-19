import Link from "next/link";
import { CALHFA_PROGRAMS, LOAN_LIMITS, PROPERTY_TAX_CONTEXT, type ZipLocalIntel } from "@/content/zip-local-intel";
import { faqJsonLd, jsonLdScript } from "@/lib/seo";
import type { ZipDistance } from "@/lib/geo/zip-geo";
import { DEMAND_ESTIMATE_LABEL, DEMAND_SOURCE } from "@/lib/zip-demand";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const EXT = "font-semibold text-violet-700 underline underline-offset-2 hover:text-violet-900";

/**
 * Local mortgage context, FAQs (with matching FAQPage JSON-LD) and links to nearby indexable ZIP
 * code pages. Shown only on ZIP code pages that pass the indexation gate.
 */
export function ZipLocalIntelSection({ intel, neighbors }: { intel: ZipLocalIntel; neighbors: ZipDistance[] }) {
  const { zip, city, county, demand } = intel;
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(intel.faqs)) }} />

      <section aria-labelledby="zip-intel-heading" className="mx-auto max-w-6xl px-6 pb-16">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-700">Local mortgage facts</p>
        <h2 id="zip-intel-heading" className="mt-2 text-3xl font-semibold">
          Buying or refinancing in {city} {zip}
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {county ? (
            <>
              <article className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold">{LOAN_LIMITS.year} loan limits, {county}</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">Conforming, one-unit</dt>
                    <dd className="font-semibold">{usd(LOAN_LIMITS.conformingOneUnit)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">FHA, one-unit</dt>
                    <dd className="font-semibold">{usd(LOAN_LIMITS.fhaFloorOneUnit)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Sources:{" "}
                  <a href={LOAN_LIMITS.conformingSource.url} target="_blank" rel="noopener noreferrer" className={EXT}>
                    FHFA
                  </a>{" "}
                  and{" "}
                  <a href={LOAN_LIMITS.fhaSource.url} target="_blank" rel="noopener noreferrer" className={EXT}>
                    HUD
                  </a>
                  . Limits are higher for two- to four-unit homes and change each year.
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold">Property tax in {county}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  California&rsquo;s base rate is {PROPERTY_TAX_CONTEXT.baseRatePct}% of assessed value. With local bonds and assessments, a newly purchased home often
                  totals about {PROPERTY_TAX_CONTEXT.typicalLowPct}% to {PROPERTY_TAX_CONTEXT.typicalHighPct}% of the purchase price a year.
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-600">An estimate, not a tax quote. The exact bill depends on the parcel.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 p-5">
                <h3 className="font-semibold">Down payment help in California</h3>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Eligible buyers can look at the{" "}
                  <a href={CALHFA_PROGRAMS.myHome.url} target="_blank" rel="noopener noreferrer" className={EXT}>
                    CalHFA MyHome Assistance Program
                  </a>{" "}
                  and the{" "}
                  <a href={CALHFA_PROGRAMS.dreamForAll.url} target="_blank" rel="noopener noreferrer" className={EXT}>
                    Dream For All Shared Appreciation Loan
                  </a>
                  .
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-600">Eligibility rules apply, funding is limited and terms change. Check CalHFA for what is open now.</p>
              </article>
            </>
          ) : null}
          <article className="rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold">Estimated 60-day activity in {zip}</h3>
            {demand.basis === "census_acs" ? (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {(
                  [
                    ["Buyers", demand.buyers],
                    ["Sellers", demand.sellers],
                    ["Renters in", demand.movers_in],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 px-2 py-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-600">{label}</dt>
                    <dd className="mt-1 text-xl font-semibold">~{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-slate-700">The Census has no residential data for this ZIP code.</p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-600">
              {DEMAND_ESTIMATE_LABEL} Households over {demand.window_days} days. Sellers are assumed equal to buyers. Source: {DEMAND_SOURCE}.
            </p>
          </article>
        </div>
      </section>

      <section aria-labelledby="zip-faq-heading" className="mx-auto max-w-4xl px-6 pb-16">
        <h2 id="zip-faq-heading" className="text-2xl font-semibold">
          Common questions about ZIP code {zip}
        </h2>
        <div className="mt-6 space-y-3">
          {intel.faqs.map((item) => (
            <details key={item.q} className="rounded-2xl border border-slate-200 p-5">
              <summary className="cursor-pointer font-semibold">{item.q}</summary>
              <p className="mt-3 text-sm leading-6 text-slate-700">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {neighbors.length > 0 ? (
        <section aria-labelledby="zip-nearby-heading" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-12">
            <h2 id="zip-nearby-heading" className="text-2xl font-semibold">
              Nearby ZIP codes
            </h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {neighbors.map((n) => (
                <li key={n.zip}>
                  <Link href={`/zip/${n.zip}`} className="inline-flex min-h-[44px] items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:ring-violet-300">
                    {n.city} {n.zip}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
