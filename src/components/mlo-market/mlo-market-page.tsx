import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerritoryClaim } from "@/components/territory-claim";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { FloatingAssistantLazy } from "@/components/assistant/floating-assistant-lazy";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/seo/breadcrumbs";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { ORGANIZATION_ID, faqJsonLd, jsonLdScript, monthlyOfferPriceSpecification } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { MARKETING_SITE_URL } from "@/lib/site";
import { MLO_MARKETS, marketFaq, type MloMarket } from "@/content/mlo-markets";

/** City pages only: the hub links to /cerebro instead of repeating the Cerebro pitch. */
const CEREBRO_POINTS: Array<[string, string]> = [
  ["Answers borrowers 24/7", "On your local page, at any hour, in plain language."],
  ["Qualifies every inquiry", "Goal, timeline, price range and contact details, with consent."],
  ["Hands the ready ones to you", "With a summary of the conversation, never to another lender."],
  ["Works your pipeline", "Flags who needs a call and drafts follow-up and local posts for your review."],
];

const HOW_ZIP_CODES_WORK: Array<[string, string]> = [
  ["Check a ZIP code", "Enter the ZIP code you work most. Checking is free and doesn't reserve it."],
  ["Pick a plan", "Pro $99, Growth $199 or Exclusive $299 a month. Each paid plan includes one ZIP code and a 15-day free trial."],
  ["It locks at your first payment", "While you hold it, no other YPN USA loan officer can claim it. Pay now or prepay 5 years to lock it today."],
  ["Borrowers reach you", "Inquiries from YPN USA pages for your ZIP code route to you, and Cerebro answers them 24/7."],
];

function offers(origin: string) {
  return PUBLIC_PRICING_TIERS.map((tier) => {
    // The advertised price (e.g. "$99"), not the legacy billed cents kept for existing subscribers.
    const price = tier.price.replace(/[^0-9.]/g, "");
    return {
      "@type": "Offer",
      name: tier.name,
      price,
      priceCurrency: "USD",
      ...(Number(price) > 0 ? { priceSpecification: monthlyOfferPriceSpecification(price) } : {}),
      url: `${origin}/pricing`,
    };
  });
}

function PlansSection() {
  return (
    <section className="py-14">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold text-[#13254a]">Plans</h2>
        <p className="mt-3 text-slate-700">Every paid plan includes one ZIP code and a 15-day free trial.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_PRICING_TIERS.map((tier) => (
            <li
              key={tier.id}
              className={`rounded-2xl border p-5 ${tier.highlight ? "border-amber-600 ring-2 ring-amber-200" : "border-slate-200"}`}
            >
              <h3 className="font-semibold text-[#13254a]">{tier.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {tier.price}
                <span className="text-sm font-medium text-slate-600"> {tier.cadence}</span>
              </p>
              <p className="mt-2 text-sm text-slate-700">{tier.tagline}</p>
              <p className="mt-2 text-xs font-semibold text-slate-700">{tier.zipCapacityLabel}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
          <Link href="/pricing" className="underline">
            Compare everything each plan includes
          </Link>
          <Link href="/roi" className="underline">
            How many extra loans pay for a plan?
          </Link>
        </p>
      </div>
    </section>
  );
}

function FaqSection({ faq }: { faq: Array<{ q: string; a: string }> }) {
  return (
    <section className="border-t border-slate-200 bg-slate-50 py-14">
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
  );
}

/**
 * /loan-officers (hub of city pages and ZIP code checks) or one city page when `market` is
 * given. Server-rendered; the only client pieces are the ZIP code checker and the Cerebro
 * launcher.
 */
export function MloMarketPage({ market, origin }: { market?: MloMarket; origin: string }) {
  return market ? <MarketPage market={market} origin={origin} /> : <HubPage origin={origin} />;
}

function HubPage({ origin }: { origin: string }) {
  const url = `${origin}/loan-officers`;
  const faq = marketFaq();
  const crumbs: BreadcrumbItem[] = homeTrail({ name: "Loan officer markets", href: "/loan-officers" });
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: PAGE_SEO.loanOfficers.title,
    description: PAGE_SEO.loanOfficers.description,
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
    publisher: { "@id": ORGANIZATION_ID },
    audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: MLO_MARKETS.length,
      itemListElement: MLO_MARKETS.map((m, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${origin}/loan-officers/${m.slug}`,
        name: `${m.city}, ${m.stateCode} loan officers`,
      })),
    },
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-14">
            <div>
              <Breadcrumbs items={crumbs} tone="light" />
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">
                For licensed mortgage loan officers
              </p>
              <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
                Find your market and claim your ZIP code
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-slate-700">
                See which ZIP codes are open in your market. Each paid plan includes one ZIP code, a local page and{" "}
                <Link href="/cerebro" className="font-semibold text-[#13254a] underline">
                  Cerebro
                </Link>{" "}
                to answer and qualify your borrowers 24/7. Checking is free.
              </p>
            </div>
            <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source="mlo_market_hub" />
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">How ZIP codes work</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_ZIP_CODES_WORK.map(([title, body], index) => (
                <li key={title} className="rounded-2xl border border-slate-200 p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#13254a] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-semibold text-[#13254a]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-slate-700">
              Exclusivity applies within YPN USA; other lenders can still market in your area. Read more about{" "}
              <Link href="/topics/exclusive-mortgage-leads" className="font-semibold text-[#13254a] underline">
                exclusive mortgage leads
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">Markets</h2>
            <p className="mt-3 text-slate-700">
              Local pages for loan officers, with more cities on the way. Don&rsquo;t see yours?{" "}
              <a href="#zip-check" className="font-semibold text-[#13254a] underline">
                Check your ZIP code
              </a>{" "}
              anyway; every US ZIP code can be checked.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MLO_MARKETS.map((m) => (
                <li key={m.slug} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-[#13254a]">
                    <Link href={`/loan-officers/${m.slug}`} className="underline-offset-2 hover:underline">
                      {m.city}, {m.stateCode} loan officers
                    </Link>
                  </h3>
                  <p className="mt-2 text-sm text-slate-700">{m.cardBlurb}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">ZIP codes: {m.zipCodes.join(", ")}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <PlansSection />
        <FaqSection faq={faq} />
      </main>
      <SiteFooter />
    </div>
  );
}

function MarketPage({ market, origin }: { market: MloMarket; origin: string }) {
  const path = `/loan-officers/${market.slug}`;
  const url = `${origin}${path}`;
  const faq = marketFaq(market);
  const crumbs: BreadcrumbItem[] = homeTrail(
    { name: "Loan officer markets", href: "/loan-officers" },
    { name: `${market.city}, ${market.stateCode}`, href: path },
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: market.title,
        description: market.description,
        about: { "@id": `${url}#service` },
        isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
        audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: `Cerebro AI assistant and exclusive ZIP codes for loan officers in ${market.city}, ${market.stateCode}`,
        serviceType: "Mortgage loan officer marketing and lead generation software",
        provider: { "@id": ORGANIZATION_ID },
        areaServed: {
          "@type": "City",
          name: `${market.city}, ${market.stateCode}`,
          containedInPlace: { "@type": "AdministrativeArea", name: `${market.county}, ${market.stateName}` },
          geo: { "@type": "GeoCoordinates", latitude: market.latitude, longitude: market.longitude },
        },
        offers: offers(origin),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(faq)) }} />

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-14">
            <div>
              <Breadcrumbs items={crumbs} tone="light" />
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">
                {market.city} · {market.county}
              </p>
              <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">{market.h1}</h1>
              <p className="mt-5 text-lg leading-relaxed text-slate-700">{market.intro}</p>
              <div className="mt-7 flex flex-wrap gap-3 text-sm font-semibold">
                <a href="#zip-check" className="rounded-full bg-[#13254a] px-6 py-3 text-white hover:bg-[#1c3566]">
                  Check your ZIP code, free
                </a>
                <OpenAssistantButton className="rounded-full border border-[#13254a] px-6 py-3 text-[#13254a] hover:bg-slate-100">
                  Talk to Cerebro
                </OpenAssistantButton>
              </div>
            </div>
            <div id="zip-check" className="rounded-3xl bg-[#13254a] p-4 text-white shadow-xl">
              <TerritoryClaim source={`mlo_market_${market.slug}`} />
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold text-[#13254a]">What Cerebro does for you</h2>
            <p className="mt-3 max-w-3xl text-slate-700">{market.whyHere}</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CEREBRO_POINTS.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-[#13254a]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-700">
              <Link href="/cerebro" className="font-semibold text-[#13254a] underline">
                See everything Cerebro does today
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">{market.city} ZIP codes loan officers claim</h2>
            <p className="mt-3 text-slate-700">
              Check any of these, or the ZIP code you work most, to see if it is still open. Nearby communities:{" "}
              {market.nearby.join(", ")}.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {market.zipCodes.map((zip) => (
                <li key={zip} className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-semibold">
                  {zip}
                </li>
              ))}
            </ul>
            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
              <Link href="/claim-territory" className="underline">
                Check your ZIP code
              </Link>
              <Link href="/loan-officers" className="underline">
                All loan officer markets
              </Link>
              <Link href="/topics/local-seo-for-loan-officers" className="underline">
                Local SEO for loan officers
              </Link>
            </p>
          </div>
        </section>

        <PlansSection />
        <FaqSection faq={faq} />
      </main>
      <SiteFooter />
      <FloatingAssistantLazy />
    </div>
  );
}
