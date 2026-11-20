import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { AuthorReviewerCard } from "@/components/seo/author-reviewer-card";
import { CopyCitation } from "@/components/reports/copy-citation";
import { CA_DRE_ID, NMLS_ID } from "@/lib/author";
import { REPORT_EDITION, REPORT_PATH, REPORT_PUBLISHED, buildDemandReport, reportCitations } from "@/lib/demand-report";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { FOUNDER_ID, ORGANIZATION_ID, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

/** Rebuilt hourly so the territory availability column follows the ledger. */
export const revalidate = 3600;

const TITLE = "Quarterly Mortgage Demand Report";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({
    title: `${TITLE} by ZIP Code`,
    description:
      "Estimated 60-day home buyer and mover households by ZIP code, from U.S. Census Bureau data: top ZIP codes nationally, 15 Central Valley ZIP codes, method.",
    path: REPORT_PATH,
  });
}

const n = (value: number) => value.toLocaleString("en-US");
const H2 = "text-2xl font-semibold text-[#13254a] lg:text-3xl";
const TH = "px-4 py-3";
const TD = "px-4 py-2";

export default function QuarterlyMortgageDemandReport() {
  const report = buildDemandReport();
  const url = `${MARKETING_SITE_URL}${REPORT_PATH}`;
  const citations = reportCitations(MARKETING_SITE_URL);

  const article = {
    "@context": "https://schema.org",
    "@type": "Report",
    "@id": `${url}#report`,
    headline: `${TITLE}, ${REPORT_EDITION}`,
    name: `${TITLE}, ${REPORT_EDITION}`,
    url,
    mainEntityOfPage: url,
    datePublished: REPORT_PUBLISHED,
    dateModified: REPORT_PUBLISHED,
    inLanguage: "en-US",
    author: { "@id": FOUNDER_ID },
    reviewedBy: { "@id": FOUNDER_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isBasedOn: "https://www.census.gov/programs-surveys/acs",
  };
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    name: `Estimated 60-day home buyer and mover households by ZIP code, ${REPORT_EDITION}`,
    description:
      "Estimated households per 60 days that moved into an owner-occupied home or a rented home, by ZIP Code Tabulation Area. YPN USA analysis of U.S. Census Bureau American Community Survey 2019-2023 5-year estimates.",
    url,
    creator: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isBasedOn: "https://www.census.gov/programs-surveys/acs",
    temporalCoverage: "2019/2023",
    spatialCoverage: { "@type": "Country", name: "United States" },
    isAccessibleForFree: true,
    variableMeasured: ["Estimated buyer households per 60 days", "Estimated renter move-in households per 60 days"],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(article) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dataset) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={homeTrail({ name: "Research", href: "/research" }, { name: TITLE, href: REPORT_PATH })} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">{REPORT_EDITION} edition</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">{TITLE}</h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              How many households buy, sell or move into a home in a typical {report.windowDays} days, by ZIP code. The figures are YPN USA estimates from U.S.
              Census Bureau survey data covering {n(report.summary.zipCodesCovered)} ZIP codes. They describe moves the Census measured. They are not forecasts
              and not lead counts.
            </p>
            <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["Buyer households / 60 days", `~${n(report.summary.buyers)}`, "moved into a home they own, all ZIP codes"],
                  ["Renter move-ins / 60 days", `~${n(report.summary.movers_in)}`, "households that moved into a rented home"],
                  ["Buyer share of move-ins", `${report.summary.buyerSharePct}%`, "of households moving in moved into an owned home"],
                  ["Median ZIP code", `~${n(report.summary.medianTotalPerZip)}`, "buyers, sellers and renter move-ins in 60 days"],
                ] as const
              ).map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</dt>
                  <dd className="mt-1 text-2xl font-bold text-[#13254a]">{value}</dd>
                  <dd className="mt-1 text-xs text-slate-600">{note}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className={H2}>Top 15 ZIP codes nationally by estimated 60-day buyer households</h2>
            <p className="mt-3 max-w-3xl text-slate-700">Ranked by households that moved into an owner-occupied home in a typical 60 days.</p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Top 15 ZIP codes in the United States by estimated buyer households in 60 days</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className={TH}>#</th>
                    <th scope="col" className={TH}>ZIP code</th>
                    <th scope="col" className={TH}>Place</th>
                    <th scope="col" className={`${TH} text-right`}>Est. buyers</th>
                    <th scope="col" className={`${TH} text-right`}>Est. renter move-ins</th>
                    <th scope="col" className={`${TH} text-right`}>Est. total</th>
                    <th scope="col" className={`${TH} text-right`}>Households</th>
                  </tr>
                </thead>
                <tbody>
                  {report.nationalTop.map((row) => (
                    <tr key={row.zip} className="border-t border-slate-200">
                      <td className={TD}>{row.rank}</td>
                      <th scope="row" className={`${TD} font-semibold`}>{row.zip}</th>
                      <td className={TD}>{row.city ? `${row.city}, ${row.state}` : "-"}</td>
                      <td className={`${TD} text-right`}>~{n(row.buyers)}</td>
                      <td className={`${TD} text-right`}>~{n(row.movers_in)}</td>
                      <td className={`${TD} text-right`}>~{n(row.total)}</td>
                      <td className={`${TD} text-right`}>{n(row.households)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className={H2}>15 Central Valley ZIP codes, with exclusive territory availability</h2>
            <p className="mt-3 max-w-3xl text-slate-700">
              Fifteen ZIP codes in Fresno, Tulare, Kings and Madera counties, ranked by estimated 60-day buyer households. Availability is live from the YPN USA territory
              ledger: {report.availability.flagshipOpen} of {report.availability.flagshipTotal} are open to a loan officer right now
              {report.availability.flagshipClaimed > 0 ? ` and ${report.availability.flagshipClaimed} are claimed` : ""}. Each ZIP code goes to one YPN USA loan officer.
            </p>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <caption className="sr-only">Fifteen Central Valley ZIP codes by estimated buyer households, with territory availability</caption>
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className={TH}>#</th>
                    <th scope="col" className={TH}>ZIP code</th>
                    <th scope="col" className={TH}>City</th>
                    <th scope="col" className={TH}>County</th>
                    <th scope="col" className={`${TH} text-right`}>Est. buyers</th>
                    <th scope="col" className={`${TH} text-right`}>Est. renter move-ins</th>
                    <th scope="col" className={`${TH} text-right`}>Est. total</th>
                    <th scope="col" className={TH}>Territory</th>
                  </tr>
                </thead>
                <tbody>
                  {report.flagship.map((row) => (
                    <tr key={row.zip} className="border-t border-slate-200">
                      <td className={TD}>{row.rank}</td>
                      <th scope="row" className={`${TD} font-semibold`}>
                        <Link href={`/zip/${row.zip}`} className="text-[#13254a] underline">
                          {row.zip}
                        </Link>
                      </th>
                      <td className={TD}>{row.city}</td>
                      <td className={TD}>{row.county}</td>
                      <td className={`${TD} text-right`}>~{n(row.buyers)}</td>
                      <td className={`${TD} text-right`}>~{n(row.movers_in)}</td>
                      <td className={`${TD} text-right`}>~{n(row.total)}</td>
                      <td className={TD}>
                        {row.status === "open" ? (
                          <Link href={`/claim-territory?zip=${row.zip}`} className="font-semibold text-emerald-800 underline">
                            Open
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-700">Claimed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className={H2}>Cite this report</h2>
            <p className="mt-3 text-slate-700">Free to quote with a link back. Please keep the note that the figures are estimates.</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CopyCitation label="Plain text" text={citations.text} />
              <CopyCitation label="HTML link" text={citations.html} />
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
            <h2 className={H2}>Source and method</h2>
            <p className="mt-3">
              <span className="font-semibold">Source.</span> {report.source}. The Census Bureau publishes these tables for ZIP Code Tabulation Areas, which follow ZIP
              code boundaries closely but not exactly.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Method.</span> {report.methodology} The Census asks where people lived a year ago. People who moved into an
              owner-occupied home are counted as buyers and people who moved into a rented home as renter move-ins. Both are converted to households using each ZIP
              code&rsquo;s own average household size and scaled from a year to {report.windowDays} days. Total is buyers, sellers and renter move-ins. The survey
              counts people living in households, so dormitories, barracks and other group quarters are not included.
            </p>
            <p className="mt-3">
              <span className="font-semibold">Limits.</span> {report.label} The survey covers 2019 to 2023, so it does not show the current month, and small ZIP codes
              have wide margins of error. A move into an owner-occupied home is usually a purchase, but not always. The Census does not measure sellers. Territory
              availability is refreshed hourly; the Census figures change only when the Bureau releases new data.
            </p>
            <p className="mt-3">
              YPN USA is a marketing technology platform for licensed mortgage loan officers. It is not a lender and does not quote rates. Nothing here is a promise of
              leads or loans, or a commitment to lend. David J. Moore, MBA &middot; NMLS #{NMLS_ID} &middot; CA DRE #{CA_DRE_ID} &middot; Equal Housing Opportunity.
            </p>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-semibold text-[#13254a]">
              <Link href="/research" className="underline">
                Loan Officer Market Report (HMDA loan data)
              </Link>
              <Link href="/check-zip" className="underline">
                Check a ZIP code
              </Link>
              <Link href="/teams/territory-audit" className="underline">
                Territory audit for teams
              </Link>
            </p>
            <AuthorReviewerCard path={REPORT_PATH} pageName={`${TITLE}, ${REPORT_EDITION}`} pageId={`${url}#report`} pageType="Report" className="mt-8" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
