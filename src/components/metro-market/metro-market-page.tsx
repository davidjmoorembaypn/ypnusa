import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { ORGANIZATION_ID, faqJsonLd, jsonLdScript } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { HMDA_SOURCE_URL, averageLoan, formatCount, formatDollars, formatDollarsCompact, sharePercent, type CountSum } from "@/content/market-report";
import { METRO_DATA_FETCHED_ON, METRO_DATA_YEAR, type MetroYear } from "@/content/metro-markets-data";
import {
  METRO_HUB_PATH,
  METRO_MARKETS,
  metroData,
  metroDescription,
  metroFaq,
  metroLabel,
  metroPath,
  metroTakeaways,
  metroTitle,
  relatedMetros,
  type MetroMarket,
} from "@/content/metro-markets";

const TYPE_ROWS: Array<[keyof MetroYear["loanTypes"], string]> = [
  ["conventional", "Conventional"],
  ["fha", "FHA"],
  ["va", "VA"],
  ["usda", "USDA"],
];
const PURPOSE_ROWS: Array<[keyof MetroYear["purposes"], string]> = [
  ["purchase", "Home purchase"],
  ["refinance", "Refinance"],
  ["cashOutRefinance", "Cash-out refinance"],
  ["homeImprovement", "Home improvement"],
  ["other", "Other purpose"],
];

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#13254a]">{value}</p>
      {note ? <p className="mt-1 text-sm text-slate-600">{note}</p> : null}
    </div>
  );
}

function MixTable<K extends string>({ caption, rows, data, total }: { caption: string; rows: Array<[K, string]>; data: Record<K, CountSum>; total: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full min-w-[440px] text-left text-sm">
        <caption className="bg-slate-50 px-4 py-3 text-left font-semibold text-[#13254a]">{caption}</caption>
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-2">Type</th>
            <th scope="col" className="px-4 py-2 text-right">Loans {METRO_DATA_YEAR}</th>
            <th scope="col" className="px-4 py-2 text-right">Share</th>
            <th scope="col" className="px-4 py-2 text-right">Avg loan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, label]) => (
            <tr key={key} className="border-b border-slate-100 last:border-0">
              <th scope="row" className="px-4 py-2 font-medium">{label}</th>
              <td className="px-4 py-2 text-right">{formatCount(data[key].count)}</td>
              <td className="px-4 py-2 text-right">{sharePercent(data[key].count, total)}%</td>
              <td className="px-4 py-2 text-right">{data[key].count >= 10 ? formatDollars(averageLoan(data[key])) : "Too few loans"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ZIP_STEPS = (m: MetroMarket): Array<[string, string]> => [
  ["Check a ZIP code", `Enter the ${m.city} ZIP code you work most. Checking is free and doesn't reserve it.`],
  ["Pick a plan", "Pro $99, Growth $199 or Exclusive $299 a month. Each paid plan includes one ZIP code and a 15-day free trial."],
  ["It locks at your first payment", "While you hold it, no other YPN USA loan officer can claim that ZIP code."],
  ["Borrowers reach you", "Inquiries from YPN USA pages for your ZIP code route to you, and Cerebro answers and qualifies them 24/7."],
];

export function MetroMarketPage({ market, origin = MARKETING_SITE_URL }: { market: MetroMarket; origin?: string }) {
  const path = metroPath(market);
  const url = `${origin}${path}`;
  const d = metroData(market);
  const label = metroLabel(market);
  const faq = metroFaq(market);
  const takeaways = metroTakeaways(market);
  const related = relatedMetros(market);
  const crumbs: BreadcrumbItem[] = homeTrail({ name: "Markets", href: METRO_HUB_PATH }, { name: label, href: path });

  const webPage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#page`,
    url,
    name: metroTitle(market),
    description: metroDescription(market),
    inLanguage: "en-US",
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    publisher: { "@id": ORGANIZATION_ID },
    dateModified: METRO_DATA_FETCHED_ON,
    about: { "@type": "City", name: market.city, containedInPlace: { "@type": "AdministrativeArea", name: `${market.county}, ${market.stateName}` } },
    audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
  };
  const dataset = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    "@id": `${url}#dataset`,
    url,
    name: `${market.county}, ${market.stateCode} mortgage originations ${METRO_DATA_YEAR}`,
    description: metroDescription(market),
    creator: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isBasedOn: HMDA_SOURCE_URL,
    temporalCoverage: String(METRO_DATA_YEAR),
    spatialCoverage: { "@type": "Place", name: `${market.county}, ${market.stateName}` },
    dateModified: METRO_DATA_FETCHED_ON,
    isAccessibleForFree: true,
    variableMeasured: ["Originated home loans", "Loan amount", "Loan type", "Loan purpose"],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(webPage) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faq)) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(dataset) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <Breadcrumbs items={crumbs} tone="light" />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">Loan officer market data</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
              {label} mortgage market for loan officers
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              {formatCount(d.total.count)} home loans were originated in {market.county}, which includes {market.city} and {market.nearby.slice(0, 3).join(", ")}, in{" "}
              {METRO_DATA_YEAR}. Here is what that market looks like, what loan officers there deal with, and how YPN USA ZIP codes work in {market.city}.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={`Loans ${METRO_DATA_YEAR}`} value={formatCount(d.total.count)} note={`about ${formatDollarsCompact(d.total.sum)} in loans`} />
              <Stat label="Home purchase share" value={`${sharePercent(d.purposes.purchase.count, d.total.count)}%`} />
              <Stat label="FHA + VA share" value={`${sharePercent(d.loanTypes.fha.count + d.loanTypes.va.count, d.total.count)}%`} note={`FHA ${sharePercent(d.loanTypes.fha.count, d.total.count)}%, VA ${sharePercent(d.loanTypes.va.count, d.total.count)}%`} />
              <Stat label="Avg purchase loan" value={formatDollars(averageLoan(d.purposes.purchase))} />
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">What the {METRO_DATA_YEAR} numbers say</h2>
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
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-2">
            <MixTable caption="By loan type" rows={TYPE_ROWS} data={d.loanTypes} total={d.total.count} />
            <MixTable caption="By loan purpose" rows={PURPOSE_ROWS} data={d.purposes} total={d.total.count} />
          </div>
        </section>

        <section className="border-t border-slate-200 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">What loan officers in {market.city} deal with</h2>
            {market.localNotes.map((p) => (
              <p key={p} className="mt-4 leading-relaxed text-slate-700">
                {p}
              </p>
            ))}
            <p className="mt-4 leading-relaxed text-slate-700">
              Local content helps with both: borrowers search for these topics by name, and a page that answers them well brings the
              conversation to you. See{" "}
              <Link href="/topics/local-seo-for-loan-officers" className="font-semibold text-[#13254a] underline">
                local SEO for loan officers
              </Link>{" "}
              and{" "}
              <Link href="/topics/realtor-referral-partnerships" className="font-semibold text-[#13254a] underline">
                realtor referral partnerships
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">How YPN USA ZIP codes work in {market.city}</h2>
            <p className="mt-3 max-w-3xl text-slate-700">
              {market.county} has many ZIP codes, and each one can be held by one YPN USA loan officer at a time. You get a local page,
              Cerebro to answer and qualify borrowers 24/7, and a ZIP code no other YPN USA loan officer can claim while you hold it.
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {ZIP_STEPS(market).map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-semibold text-amber-800">Step {i + 1}</p>
                  <h3 className="mt-1 font-semibold text-[#13254a]">{title}</h3>
                  <p className="mt-2 text-sm text-slate-700">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[#13254a]">Work in {market.city}? Check your ZIP code.</h2>
              <p className="mt-3 text-slate-700">Checking is free and takes a few seconds. It shows whether another YPN USA loan officer already holds it.</p>
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
              <TerritoryClaim source={`metro_market_${market.slug}`} />
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

        <section className="py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">More markets</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={metroPath(r)} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                    {metroLabel(r)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={METRO_HUB_PATH} className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                  All markets
                </Link>
              </li>
              <li>
                <Link href="/research" className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[#13254a] hover:bg-slate-50">
                  Central Valley market report
                </Link>
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 text-sm leading-relaxed text-slate-700 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Source and method</h2>
            <p className="mt-3">
              Numbers come from public Home Mortgage Disclosure Act (HMDA) data published by the CFPB and FFIEC, through the{" "}
              <a href={HMDA_SOURCE_URL} className="font-semibold text-[#13254a] underline" rel="noopener">
                HMDA Data Browser
              </a>
              . They count loans that lenders reported as originated in {market.county} in {METRO_DATA_YEAR}, across all reporting lenders.
              Comparisons are with the other {METRO_MARKETS.length} big-city markets on this site. Data retrieved {METRO_DATA_FETCHED_ON}.
            </p>
            <p className="mt-3">
              HMDA reports loan amounts rounded to the middle of a $10,000 range, so dollar totals and averages are close approximations.
              Some small lenders are not required to report, so true totals are somewhat higher. This page shows market activity only; it
              does not rank lenders, quote rates or predict results. YPN USA is a marketing technology company, not a lender.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

/** List of every big-city market page, used on the /markets hub. */
export function MetroMarketList() {
  const sorted = [...METRO_MARKETS].sort((a, b) => a.city.localeCompare(b.city));
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((m) => (
        <li key={m.slug}>
          <Link href={metroPath(m)} className="font-semibold text-violet-700 hover:underline">
            {metroLabel(m)} loan officer market data
          </Link>
        </li>
      ))}
    </ul>
  );
}
