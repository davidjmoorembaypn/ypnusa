import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { ORGANIZATION_ID, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { HMDA_SOURCE_URL, formatCount, formatDollars } from "@/content/market-report";
import { METRO_AREA_DATA_FETCHED_ON } from "@/content/metro-areas-data";
import { METRO_AREAS, METRO_AREA_HUB_PATH, METRO_AREA_YEAR, metricMedian, metroAreaPath, statsFor } from "@/content/metro-areas";

export function MetroAreaHub() {
  const url = `${MARKETING_SITE_URL}${METRO_AREA_HUB_PATH}`;
  const total = METRO_AREAS.reduce((n, m) => n + statsFor(m).originations, 0);
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${url}#list`,
    name: `Top 100 metro mortgage markets, ${METRO_AREA_YEAR}`,
    numberOfItems: METRO_AREAS.length,
    itemListElement: METRO_AREAS.map((m) => ({ "@type": "ListItem", position: m.rank, url: `${MARKETING_SITE_URL}${metroAreaPath(m)}`, name: m.name })),
  };
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    url,
    name: `Home mortgage originations in the 100 busiest US metro areas, ${METRO_AREA_YEAR}`,
    description: `Originated loans, loan types, loan purposes and application outcomes for 100 HMDA metro areas, ${METRO_AREA_YEAR}.`,
    creator: { "@id": ORGANIZATION_ID },
    isBasedOn: HMDA_SOURCE_URL,
    temporalCoverage: String(METRO_AREA_YEAR),
    dateModified: METRO_AREA_DATA_FETCHED_ON,
    isAccessibleForFree: true,
  };
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(list) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dataset) }} />
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={homeTrail({ name: "Markets", href: "/markets" }, { name: "Top 100 metros", href: METRO_AREA_HUB_PATH })} tone="light" />
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">Top 100 metro mortgage markets for loan officers</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              The 100 HMDA metro areas with the most {METRO_AREA_YEAR} mortgage records, ranked by originated home loans: {formatCount(total)} loans in all. Each
              page shows the local loan mix, approval and denial rates, how the market compares with the other 99, and what that means for a loan officer&apos;s
              marketing. The median average loan across the 100 is {formatDollars(metricMedian("avgLoan"))}; the median purchase share is {metricMedian("purchaseShare")}%.
            </p>
          </div>
        </section>
        <section className="py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="bg-slate-50 px-4 py-3 text-left font-semibold text-[#13254a]">Ranked by originated home loans, {METRO_AREA_YEAR}</caption>
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-right">#</th>
                    <th scope="col" className="px-4 py-2">Metro area</th>
                    <th scope="col" className="px-4 py-2 text-right">Loans</th>
                    <th scope="col" className="px-4 py-2 text-right">Avg loan</th>
                    <th scope="col" className="px-4 py-2 text-right">Purchase</th>
                    <th scope="col" className="px-4 py-2 text-right">FHA</th>
                    <th scope="col" className="px-4 py-2 text-right">VA</th>
                    <th scope="col" className="px-4 py-2 text-right">Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {METRO_AREAS.map((m) => {
                    const s = statsFor(m);
                    return (
                      <tr key={m.code} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 text-right">{m.rank}</td>
                        <th scope="row" className="px-4 py-2 font-medium">
                          <Link href={metroAreaPath(m)} className="text-[#13254a] underline">
                            {m.name}
                          </Link>
                        </th>
                        <td className="px-4 py-2 text-right">{formatCount(s.originations)}</td>
                        <td className="px-4 py-2 text-right">{formatDollars(s.avgLoan)}</td>
                        <td className="px-4 py-2 text-right">{s.purchaseShare}%</td>
                        <td className="px-4 py-2 text-right">{s.fhaShare}%</td>
                        <td className="px-4 py-2 text-right">{s.vaShare}%</td>
                        <td className="px-4 py-2 text-right">{s.denialRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-slate-700">
              Source: CFPB and FFIEC{" "}
              <a href={HMDA_SOURCE_URL} className="font-semibold text-[#13254a] underline" rel="noopener">
                HMDA Data Browser
              </a>
              , {METRO_AREA_YEAR} data for HMDA metro areas (MSAs and metropolitan divisions), all reporting lenders. Denial rate is denied applications as a share
              of applications that reached a credit decision. Retrieved {METRO_AREA_DATA_FETCHED_ON}. YPN USA is a marketing technology company, not a lender.
            </p>
            <p className="mt-4 text-sm font-semibold text-[#13254a]">
              <Link href="/markets" className="underline">
                City and county market pages
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
