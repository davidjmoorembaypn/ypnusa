import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { ORGANIZATION_ID, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import {
  DATA_FETCHED_ON,
  HMDA_SOURCE_URL,
  LATEST_YEAR,
  PREVIOUS_YEAR,
  REPORT_COUNTIES,
  REPORT_REGION,
  averageLoan,
  countyTakeaways,
  formatChange,
  formatCount,
  formatDollars,
  formatDollarsCompact,
  percentChange,
  regionTotals,
  sharePercent,
  type CountSum,
  type CountyYear,
  type ReportCounty,
} from "@/content/market-report";

export const REPORT_HUB_PATH = "/research";
export const reportCountyPath = (county: ReportCounty) => `${REPORT_HUB_PATH}/${county.slug}`;

export const REPORT_HUB_TITLE = `Central Valley Mortgage Market Report ${LATEST_YEAR} for Loan Officers | YPN USA`;
export const REPORT_HUB_DESCRIPTION = `How many home loans were made in ${REPORT_REGION} in ${LATEST_YEAR}? County-by-county HMDA data for loan officers: originations, FHA and VA share, purchase vs refinance, and change since ${PREVIOUS_YEAR}.`;

export function countyTitle(county: ReportCounty) {
  return `${county.name}, ${county.stateCode} Mortgage Market Report ${LATEST_YEAR} | YPN USA`;
}
export function countyDescription(county: ReportCounty) {
  const now = county.years[LATEST_YEAR].total.count;
  const change = percentChange(county.years[PREVIOUS_YEAR].total.count, now);
  return `${formatCount(now)} home loans were originated in ${county.name} in ${LATEST_YEAR} (${formatChange(
    change,
  )} vs ${PREVIOUS_YEAR}). FHA, VA, purchase and refinance numbers from public HMDA data, for loan officers.`;
}

const TYPE_ROWS: Array<[keyof CountyYear["loanTypes"], string]> = [
  ["conventional", "Conventional"],
  ["fha", "FHA"],
  ["va", "VA"],
  ["usda", "USDA"],
];
const PURPOSE_ROWS: Array<[keyof CountyYear["purposes"], string]> = [
  ["purchase", "Home purchase"],
  ["refinance", "Refinance"],
  ["cashOutRefinance", "Cash-out refinance"],
  ["homeImprovement", "Home improvement"],
  ["other", "Other purpose"],
];

function datasetJsonLd(url: string, name: string, description: string, spatial: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    url,
    name,
    description,
    creator: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isBasedOn: HMDA_SOURCE_URL,
    temporalCoverage: `${PREVIOUS_YEAR}/${LATEST_YEAR}`,
    spatialCoverage: { "@type": "Place", name: spatial },
    dateModified: DATA_FETCHED_ON,
    isAccessibleForFree: true,
    variableMeasured: ["Originated home loans", "Loan amount", "Loan type", "Loan purpose"],
  };
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#13254a]">{value}</p>
      {note ? <p className="mt-1 text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}

function CompareTable<K extends string>({
  caption,
  rows,
  now,
  before,
  total,
}: {
  caption: string;
  rows: Array<[K, string]>;
  now: Record<K, CountSum>;
  before: Record<K, CountSum>;
  total: number;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="bg-slate-50 px-4 py-3 text-left font-semibold text-[#13254a]">{caption}</caption>
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-2">Type</th>
            <th scope="col" className="px-4 py-2 text-right">Loans {LATEST_YEAR}</th>
            <th scope="col" className="px-4 py-2 text-right">Share</th>
            <th scope="col" className="px-4 py-2 text-right">Loans {PREVIOUS_YEAR}</th>
            <th scope="col" className="px-4 py-2 text-right">Change</th>
            <th scope="col" className="px-4 py-2 text-right">Avg loan {LATEST_YEAR}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, label]) => (
            <tr key={key} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-2 font-medium">{label}</th>
              <td className="px-4 py-2 text-right">{formatCount(now[key].count)}</td>
              <td className="px-4 py-2 text-right">{sharePercent(now[key].count, total)}%</td>
              <td className="px-4 py-2 text-right">{formatCount(before[key].count)}</td>
              <td className="px-4 py-2 text-right">{formatChange(percentChange(before[key].count, now[key].count))}</td>
              <td className="px-4 py-2 text-right">{now[key].count >= 10 ? formatDollars(averageLoan(now[key])) : "Too few loans"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Methodology() {
  return (
    <section className="border-t border-slate-200 bg-slate-50 py-12">
      <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
        <h2 className="text-2xl font-semibold text-[#13254a]">Source and method</h2>
        <p className="mt-3">
          Numbers come from public Home Mortgage Disclosure Act (HMDA) data published by the CFPB and FFIEC, through the{" "}
          <a href={HMDA_SOURCE_URL} className="font-semibold text-[#13254a] underline" rel="noopener">
            HMDA Data Browser
          </a>
          . They count loans that lenders reported as originated in each county for calendar years {PREVIOUS_YEAR} and {LATEST_YEAR},
          across all reporting lenders. Data retrieved {DATA_FETCHED_ON}.
        </p>
        <p className="mt-3">
          HMDA reports loan amounts rounded to the middle of a $10,000 range, so dollar totals and averages are close approximations.
          Some small lenders are not required to report, so true market totals are somewhat higher. These pages show market activity
          only; they do not rank lenders, quote rates or predict results.
        </p>
        <p className="mt-3">
          You are welcome to quote or chart these numbers. Please credit &ldquo;YPN USA analysis of HMDA data&rdquo; and link to this
          page. Read how we review content in our{" "}
          <Link href="/research-methodology" className="font-semibold text-[#13254a] underline">
            research methodology
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

function ZipCta({ source }: { source: string }) {
  return (
    <section className="py-12">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <h2 className="text-3xl font-semibold text-[#13254a]">Work this market? Check your ZIP code.</h2>
          <p className="mt-3 text-slate-700">
            YPN USA gives loan officers a local page, Cerebro to answer and qualify borrowers 24/7, and one ZIP code no other YPN USA
            loan officer can claim. Checking is free.
          </p>
          <p className="mt-4 text-sm font-semibold text-[#13254a]">
            <Link href="/loan-officers" className="underline">
              See all loan officer markets
            </Link>
          </p>
        </div>
        <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
          <TerritoryClaim source={source} />
        </div>
      </div>
    </section>
  );
}

export function MarketReportHub({ origin = MARKETING_SITE_URL }: { origin?: string }) {
  const url = `${origin}${REPORT_HUB_PATH}`;
  const now = regionTotals(LATEST_YEAR);
  const before = regionTotals(PREVIOUS_YEAR);
  const crumbs: BreadcrumbItem[] = homeTrail({ name: "Market report", href: REPORT_HUB_PATH });
  const counties = [...REPORT_COUNTIES].sort((a, b) => b.years[LATEST_YEAR].total.count - a.years[LATEST_YEAR].total.count);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(datasetJsonLd(url, `Central Valley mortgage originations ${PREVIOUS_YEAR}-${LATEST_YEAR}`, REPORT_HUB_DESCRIPTION, REPORT_REGION)),
          }}
        />
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={crumbs} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">Loan Officer Market Report</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
              Central Valley mortgage market, {LATEST_YEAR}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              {formatCount(now.total.count)} home loans worth about {formatDollarsCompact(now.total.sum)} were originated across{" "}
              {REPORT_COUNTIES.length} Central Valley counties in {LATEST_YEAR}, {formatChange(percentChange(before.total.count, now.total.count))}{" "}
              from {PREVIOUS_YEAR}. County numbers below come from public HMDA data.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={`Loans ${LATEST_YEAR}`} value={formatCount(now.total.count)} note={`${formatChange(percentChange(before.total.count, now.total.count))} vs ${PREVIOUS_YEAR}`} />
              <Stat label="Home purchase share" value={`${sharePercent(now.purposes.purchase.count, now.total.count)}%`} />
              <Stat label="FHA share" value={`${sharePercent(now.loanTypes.fha.count, now.total.count)}%`} />
              <Stat label="VA share" value={`${sharePercent(now.loanTypes.va.count, now.total.count)}%`} />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">By county</h2>
            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Originated home loans by county, {LATEST_YEAR} vs {PREVIOUS_YEAR}</caption>
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2">County</th>
                    <th scope="col" className="px-4 py-2 text-right">Loans {LATEST_YEAR}</th>
                    <th scope="col" className="px-4 py-2 text-right">Change vs {PREVIOUS_YEAR}</th>
                    <th scope="col" className="px-4 py-2 text-right">Purchase share</th>
                    <th scope="col" className="px-4 py-2 text-right">FHA share</th>
                    <th scope="col" className="px-4 py-2 text-right">VA share</th>
                    <th scope="col" className="px-4 py-2 text-right">Avg purchase loan</th>
                  </tr>
                </thead>
                <tbody>
                  {counties.map((c) => {
                    const y = c.years[LATEST_YEAR];
                    return (
                      <tr key={c.slug} className="border-b border-slate-100 last:border-0">
                        <th scope="row" className="px-4 py-2 font-medium">
                          <Link href={reportCountyPath(c)} className="text-[#13254a] underline">
                            {c.name}
                          </Link>
                        </th>
                        <td className="px-4 py-2 text-right">{formatCount(y.total.count)}</td>
                        <td className="px-4 py-2 text-right">{formatChange(percentChange(c.years[PREVIOUS_YEAR].total.count, y.total.count))}</td>
                        <td className="px-4 py-2 text-right">{sharePercent(y.purposes.purchase.count, y.total.count)}%</td>
                        <td className="px-4 py-2 text-right">{sharePercent(y.loanTypes.fha.count, y.total.count)}%</td>
                        <td className="px-4 py-2 text-right">{sharePercent(y.loanTypes.va.count, y.total.count)}%</td>
                        <td className="px-4 py-2 text-right">{formatDollars(averageLoan(y.purposes.purchase))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ZipCta source="market_report_hub" />
        <Methodology />
      </main>
      <SiteFooter />
    </div>
  );
}

export function MarketReportCounty({ county, origin = MARKETING_SITE_URL }: { county: ReportCounty; origin?: string }) {
  const url = `${origin}${reportCountyPath(county)}`;
  const now = county.years[LATEST_YEAR];
  const before = county.years[PREVIOUS_YEAR];
  const crumbs: BreadcrumbItem[] = homeTrail(
    { name: "Market report", href: REPORT_HUB_PATH },
    { name: county.name, href: reportCountyPath(county) },
  );
  const takeaways = countyTakeaways(county);
  const others = REPORT_COUNTIES.filter((c) => c.slug !== county.slug);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              datasetJsonLd(url, `${county.name}, ${county.stateCode} mortgage originations ${PREVIOUS_YEAR}-${LATEST_YEAR}`, countyDescription(county), `${county.name}, ${county.stateCode}`),
            ),
          }}
        />
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={crumbs} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">Loan Officer Market Report</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
              {county.name}, {county.stateCode} mortgage market, {LATEST_YEAR}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              Home loans originated in {county.name} ({county.cities.join(", ")}), from public HMDA data.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={`Loans ${LATEST_YEAR}`} value={formatCount(now.total.count)} note={`${formatChange(percentChange(before.total.count, now.total.count))} vs ${PREVIOUS_YEAR}`} />
              <Stat label="Loan volume" value={`about ${formatDollarsCompact(now.total.sum)}`} />
              <Stat label="Home purchase share" value={`${sharePercent(now.purposes.purchase.count, now.total.count)}%`} />
              <Stat label="Avg purchase loan" value={formatDollars(averageLoan(now.purposes.purchase))} />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">Key numbers</h2>
            <ul className="mt-6 space-y-3 text-slate-800">
              {takeaways.map((line) => (
                <li key={line} className="rounded-xl border border-slate-200 p-4">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pb-12">
          <div className="mx-auto w-full max-w-5xl space-y-8 px-4 sm:px-6">
            <CompareTable caption="By loan type" rows={TYPE_ROWS} now={now.loanTypes} before={before.loanTypes} total={now.total.count} />
            <CompareTable caption="By loan purpose" rows={PURPOSE_ROWS} now={now.purposes} before={before.purposes} total={now.total.count} />
          </div>
        </section>

        <section className="border-t border-slate-200 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Using this as a loan officer</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
              <li>
                Match your content to the loans people here actually take: if FHA or VA is a large share, borrowers search for those
                programs by name. See{" "}
                <Link href="/topics/local-seo-for-loan-officers" className="font-semibold text-[#13254a] underline">
                  local SEO for loan officers
                </Link>
                .
              </li>
              <li>
                Purchase-heavy markets reward strong realtor relationships. See{" "}
                <Link href="/topics/realtor-referral-partnerships" className="font-semibold text-[#13254a] underline">
                  realtor referral partnerships
                </Link>
                .
              </li>
              <li>
                Share these numbers with your referral partners; credit the source as shown below.
              </li>
            </ul>
          </div>
        </section>

        <ZipCta source="market_report_county" />

        <section className="pb-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Other Central Valley counties</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {others.map((c) => (
                <li key={c.slug}>
                  <Link href={reportCountyPath(c)} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={REPORT_HUB_PATH} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                  Full Central Valley report
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <Methodology />
      </main>
      <SiteFooter />
    </div>
  );
}
