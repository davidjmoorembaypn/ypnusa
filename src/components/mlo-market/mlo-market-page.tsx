import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { faqJsonLd } from "@/lib/seo";
import { founderCredentialJsonLd } from "@/lib/seo/founder-credentials";
import { MARKETING_SITE_URL } from "@/lib/site";
import { MLO_MARKETS, marketFaq, type MloMarket } from "@/content/mlo-markets";

const CEREBRO_POINTS: Array<[string, string]> = [
  ["Answers borrowers 24/7", "On your site, under your brand, at any hour."],
  ["Qualifies every inquiry", "Goal, timeline, price range and contact details, with consent."],
  ["Books time with you", "Offers your open slots and hands you a summary."],
  ["Works your pipeline", "Flags who needs a call and drafts follow-up for your review."],
];

/**
 * Loan-officer-facing landing page for one market, or the nationwide hub when `market`
 * is omitted. Server-rendered; the only client pieces are the ZIP checker and the
 * Cerebro launcher.
 */
export function MloMarketPage({ market, origin }: { market?: MloMarket; origin: string }) {
  const path = market ? `/loan-officers/${market.slug}` : "/loan-officers";
  const url = `${origin}${path}`;
  const faq = marketFaq(market);
  const crumbs: BreadcrumbItem[] = [
    { name: "Home", href: "/" },
    { name: "For loan officers", href: "/loan-officers" },
    ...(market ? [{ name: `${market.city}, ${market.stateCode}`, href: path }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: market ? market.title : "AI Assistant & Exclusive Mortgage Leads for Loan Officers",
        about: { "@id": `${url}#service` },
        isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
        audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: "Cerebro AI assistant and protected ZIP territories for mortgage loan officers",
        serviceType: "Mortgage loan officer marketing and lead generation software",
        provider: { "@id": `${MARKETING_SITE_URL}/#organization` },
        areaServed: market
          ? {
              "@type": "City",
              name: market.city,
              containedInPlace: { "@type": "AdministrativeArea", name: `${market.county}, ${market.stateName}` },
              geo: { "@type": "GeoCoordinates", latitude: market.latitude, longitude: market.longitude },
            }
          : { "@type": "Country", name: "United States" },
        offers: PUBLIC_PRICING_TIERS.map((tier) => ({
          "@type": "Offer",
          name: tier.name,
          price: (tier.priceMonthlyCents / 100).toFixed(2),
          priceCurrency: "USD",
          url: `${origin}/pricing`,
        })),
      },
      founderCredentialJsonLd(),
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <Breadcrumbs items={crumbs} />
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">
                {market ? `${market.city} · ${market.county}` : "For licensed mortgage loan officers"}
              </p>
              <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
                {market ? market.h1 : "Cerebro AI and exclusive ZIP territories for mortgage loan officers"}
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-slate-700">
                {market
                  ? market.intro
                  : "Cerebro answers and qualifies your borrowers 24/7, keeps your follow-up moving and hands you the ready ones. Every paid plan protects one ZIP, so the demand in your market comes to you."}
              </p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
                <a href="#zip-check" className="rounded-full bg-[#13254a] px-6 py-3 text-white hover:bg-[#1c3566]">
                  Check my ZIP, free
                </a>
                <OpenAssistantButton className="rounded-full border border-[#13254a] px-6 py-3 text-[#13254a] hover:bg-slate-100">
                  Talk to Cerebro
                </OpenAssistantButton>
              </div>
            </div>
            <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source={market ? `mlo_market_${market.slug}` : "mlo_market_hub"} />
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">What Cerebro does for you and your borrowers</h2>
            {market && <p className="mt-3 max-w-3xl text-slate-700">{market.whyHere}</p>}
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CEREBRO_POINTS.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-slate-200 p-5">
                  <p className="font-semibold text-[#13254a]">{title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {market && (
          <section className="border-y border-slate-200 bg-slate-50 py-12">
            <div className="mx-auto w-full max-w-6xl px-6">
              <h2 className="text-2xl font-semibold text-[#13254a]">ZIPs loan officers claim in {market.city}</h2>
              <p className="mt-3 text-slate-700">
                Check any of these, or the ZIP you work most, to see if it is still open. Nearby communities:{" "}
                {market.nearby.join(", ")}.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {market.zipCodes.map((zip) => (
                  <li key={zip} className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold">
                    {zip}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <section className="py-14">
          <div className="mx-auto w-full max-w-6xl px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">Plans for loan officers</h2>
            <p className="mt-3 text-slate-700">Every paid plan includes one protected ZIP and a 15-day free trial.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PUBLIC_PRICING_TIERS.map((tier) => (
                <li
                  key={tier.id}
                  className={`rounded-2xl border p-5 ${tier.highlight ? "border-amber-500 ring-2 ring-amber-200" : "border-slate-200"}`}
                >
                  <p className="font-semibold text-[#13254a]">{tier.name}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {tier.price}
                    <span className="text-sm font-medium text-slate-500"> {tier.cadence}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{tier.tagline}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">{tier.zipCapacityLabel}</p>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="mt-6 inline-block text-sm font-semibold text-[#13254a] underline">
              Compare everything each plan includes
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto w-full max-w-3xl px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">Questions loan officers ask</h2>
            <div className="mt-8 space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-semibold">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {!market && MLO_MARKETS.length > 0 && (
          <section className="py-12">
            <div className="mx-auto w-full max-w-6xl px-6">
              <h2 className="text-2xl font-semibold text-[#13254a]">Local markets</h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {MLO_MARKETS.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/loan-officers/${m.slug}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
                      Loan officers in {m.city}, {m.stateCode}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
