import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { ORGANIZATION_ID, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { HMDA_SOURCE_URL, averageLoan, formatCount, formatDollars, sharePercent, type CountSum } from "@/content/market-report";
import { METRO_AREA_DATA_FETCHED_ON } from "@/content/metro-areas-data";
import {
  METRO_AREAS,
  METRO_AREA_HUB_PATH,
  METRO_AREA_YEAR,
  metroAreaData,
  metroAreaDescription,
  metroAreaFaq,
  metroAreaFindings,
  metroAreaIntro,
  metroAreaPath,
  metroAreaPeerNotes,
  metroAreaPeers,
  metroAreaPlays,
  metroAreaTitle,
  metroAreaYpnFit,
  statsFor,
  type MetroArea,
} from "@/content/metro-areas";
import { metroAreaZips } from "@/lib/metro-area-zips";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#13254a]">{value}</p>
      {note ? <p className="mt-1 text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}

function Breakdown({ caption, rows, total, unit }: { caption: string; rows: Array<[string, CountSum]>; total: number; unit: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[440px] text-left text-sm">
        <caption className="bg-slate-50 px-4 py-3 text-left font-semibold text-[#13254a]">{caption}</caption>
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-2">{unit}</th>
            <th scope="col" className="px-4 py-2 text-right">Count</th>
            <th scope="col" className="px-4 py-2 text-right">Share</th>
            <th scope="col" className="px-4 py-2 text-right">Avg amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, cs]) => (
            <tr key={label} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-2 font-medium">{label}</th>
              <td className="px-4 py-2 text-right">{formatCount(cs.count)}</td>
              <td className="px-4 py-2 text-right">{sharePercent(cs.count, total)}%</td>
              <td className="px-4 py-2 text-right">{cs.count >= 10 ? formatDollars(averageLoan(cs)) : "Too few"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MetroAreaPage({ metro, origin = MARKETING_SITE_URL }: { metro: MetroArea; origin?: string }) {
  const path = metroAreaPath(metro);
  const url = `${origin}${path}`;
  const s = statsFor(metro);
  const d = metroAreaData(metro).y2024;
  const faq = metroAreaFaq(metro);
  const peers = metroAreaPeers(metro);
  const table = [...peers, metro].sort((a, b) => a.rank - b.rank);
  const zips = metroAreaZips(metro);
  const crumbs: BreadcrumbItem[] = homeTrail({ name: "Markets", href: "/markets" }, { name: "Top 100 metros", href: METRO_AREA_HUB_PATH }, { name: `${metro.short} metro`, href: path });
  const placesNamed = zips.length ? [...new Set(zips.map((z) => z.city))] : [];
  const a = d.actions;
  const apps = a.originated.count + a.approvedNotAccepted.count + a.denied.count + a.withdrawn.count + a.incomplete.count;

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    url,
    name: metroAreaTitle(metro),
    description: metroAreaDescription(metro),
    inLanguage: "en-US",
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    publisher: { "@id": ORGANIZATION_ID },
    dateModified: METRO_AREA_DATA_FETCHED_ON,
    about: { "@type": "Place", name: `${metro.name} metro area` },
    audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
  };
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    url,
    name: `${metro.name} home mortgage originations and application outcomes, ${METRO_AREA_YEAR}`,
    description: metroAreaDescription(metro),
    creator: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isBasedOn: HMDA_SOURCE_URL,
    citation: `Consumer Financial Protection Bureau and FFIEC, Home Mortgage Disclosure Act (HMDA) data, ${METRO_AREA_YEAR}, MSA/MD ${metro.code}`,
    temporalCoverage: String(METRO_AREA_YEAR),
    spatialCoverage: { "@type": "Place", name: `${metro.name} (HMDA MSA/MD ${metro.code})` },
    dateModified: METRO_AREA_DATA_FETCHED_ON,
    isAccessibleForFree: true,
    variableMeasured: ["Originated home loans", "Loan amount", "Loan type", "Loan purpose", "Application outcome"],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(webPage) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dataset) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={crumbs} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">
              Metro #{metro.rank} of 100 · {METRO_AREA_YEAR} HMDA data
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">{metro.short} metro mortgage market for loan officers</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">{metroAreaIntro(metro)}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={`Loans ${METRO_AREA_YEAR}`} value={formatCount(s.originations)} note={`${formatCount(apps)} applications`} />
              <Stat label="Average loan" value={formatDollars(s.avgLoan)} note={`purchase ${formatDollars(s.avgPurchaseLoan)}`} />
              <Stat label="Home purchase share" value={`${s.purchaseShare}%`} note={`cash-out ${s.cashOutShare}%`} />
              <Stat label="Denial rate" value={`${s.denialRate}%`} note={`of decided applications`} />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">What stands out in {metro.short}</h2>
            <p className="mt-3 text-slate-700">Where this market sits among the 100 metro areas, on the measures where it is furthest from typical.</p>
            <ul className="mt-6 space-y-3 text-slate-800">
              {metroAreaFindings(metro).map((line) => (
                <li key={line} className="rounded-xl border border-slate-200 p-4">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pb-12">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-3">
            <Breakdown
              caption="Originated loans by type"
              unit="Loan type"
              total={s.originations}
              rows={[
                ["Conventional", d.loanTypes.conventional],
                ["FHA", d.loanTypes.fha],
                ["VA", d.loanTypes.va],
                ["USDA", d.loanTypes.usda],
              ]}
            />
            <Breakdown
              caption="Originated loans by purpose"
              unit="Purpose"
              total={s.originations}
              rows={[
                ["Home purchase", d.purposes.purchase],
                ["Refinance", d.purposes.refinance],
                ["Cash-out refinance", d.purposes.cashOutRefinance],
                ["Home improvement", d.purposes.homeImprovement],
                ["Other", d.purposes.other],
              ]}
            />
            <Breakdown
              caption="What happened to applications"
              unit="Outcome"
              total={apps}
              rows={[
                ["Originated", a.originated],
                ["Approved, not accepted", a.approvedNotAccepted],
                ["Denied", a.denied],
                ["Withdrawn", a.withdrawn],
                ["Closed as incomplete", a.incomplete],
              ]}
            />
          </div>
        </section>

        <section className="border-t border-slate-200 py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">{metro.short} next to similar-sized metros</h2>
            {metroAreaPeerNotes(metro).map((line) => (
              <p key={line} className="mt-3 max-w-3xl text-slate-700">
                {line}
              </p>
            ))}
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2">Metro area</th>
                    <th scope="col" className="px-4 py-2 text-right">Rank</th>
                    <th scope="col" className="px-4 py-2 text-right">Loans</th>
                    <th scope="col" className="px-4 py-2 text-right">Avg loan</th>
                    <th scope="col" className="px-4 py-2 text-right">Purchase</th>
                    <th scope="col" className="px-4 py-2 text-right">FHA + VA</th>
                    <th scope="col" className="px-4 py-2 text-right">Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((m) => {
                    const ms = statsFor(m);
                    const self = m.code === metro.code;
                    return (
                      <tr key={m.code} className={`border-b border-slate-100 last:border-0 ${self ? "bg-amber-50 font-semibold" : ""}`}>
                        <th scope="row" className="px-4 py-2 font-medium">
                          {self ? (
                            m.name
                          ) : (
                            <Link href={metroAreaPath(m)} className="text-[#13254a] underline">
                              {m.name}
                            </Link>
                          )}
                        </th>
                        <td className="px-4 py-2 text-right">{m.rank}</td>
                        <td className="px-4 py-2 text-right">{formatCount(ms.originations)}</td>
                        <td className="px-4 py-2 text-right">{formatDollars(ms.avgLoan)}</td>
                        <td className="px-4 py-2 text-right">{ms.purchaseShare}%</td>
                        <td className="px-4 py-2 text-right">{Math.round((ms.fhaShare + ms.vaShare) * 10) / 10}%</td>
                        <td className="px-4 py-2 text-right">{ms.denialRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">Where to focus your marketing in {metro.short}</h2>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {metroAreaPlays(metro).map((p) => (
                <div key={p.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-[#13254a]">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
            <div>
              <h2 className="text-3xl font-semibold text-[#13254a]">ZIP codes in the {metro.short} area</h2>
              <p className="mt-3 text-slate-700">{metroAreaYpnFit(metro)}</p>
              {zips.length ? (
                <>
                  <p className="mt-6 text-sm font-semibold text-slate-700">ZIP codes in {placesNamed.join(", ")}:</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {zips.map((z) => (
                      <li key={z.zip}>
                        <Link href={`/zip/${z.zip}`} className="inline-flex rounded-full border border-slate-300 px-3 py-1 text-sm text-[#13254a] hover:bg-slate-50">
                          {z.zip}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
                <Link href="/pricing" className="underline">
                  See plans and pricing
                </Link>
                <Link href="/cerebro" className="underline">
                  What Cerebro does
                </Link>
                {metro.countyPage ? (
                  <Link href={metro.countyPage} className="underline">
                    {metro.short} county-level data
                  </Link>
                ) : null}
              </p>
            </div>
            <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source={`metro_area_${metro.slug}`} />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">FAQ</h2>
            <div className="mt-8 space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-10">
          <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Source and method</h2>
            <p className="mt-3">
              Public Home Mortgage Disclosure Act data from the CFPB and FFIEC (
              <a href={HMDA_SOURCE_URL} className="font-semibold text-[#13254a] underline" rel="noopener">
                HMDA Data Browser
              </a>
              ), {METRO_AREA_YEAR}, for HMDA metro area {metro.code}, all reporting lenders. Medians and places compare the{" "}
              <Link href={METRO_AREA_HUB_PATH} className="font-semibold text-[#13254a] underline">
                {METRO_AREAS.length} metro areas
              </Link>{" "}
              with the most {METRO_AREA_YEAR} HMDA records. Loan amounts are reported to the middle of a $10,000 range. This page describes market activity; it
              does not rank lenders or quote rates. YPN USA is a marketing technology company, not a lender. Retrieved {METRO_AREA_DATA_FETCHED_ON}.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
