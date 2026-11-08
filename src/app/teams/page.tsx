import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { PUBLIC_PRICING_TIERS, TRIAL_DAYS } from "@/lib/pricing";
import { ORGANIZATION_ID, faqJsonLd, jsonLdScript, marketingMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.teams, absoluteTitle: true, path: "/teams" });
}

const PATH = "/teams";
const URL = `${MARKETING_SITE_URL}${PATH}`;
const PAID_TIERS = PUBLIC_PRICING_TIERS.filter((tier) => tier.id !== "free");

const EACH_GETS: Array<[string, string]> = [
  ["Their own exclusive ZIP code", "Each paid plan includes one ZIP code. While a loan officer holds it, no other YPN USA loan officer can claim it."],
  ["Local pages", "Pages for their market that borrowers can find, with inquiries routed to that loan officer."],
  ["Cerebro AI follow-up", "Cerebro answers and qualifies borrowers 24/7 on their pages and hands the ready ones to that loan officer."],
  ["Their own dashboard", "A growth plan for their ZIP code, a view of who needs a call, and marketing drafts to review."],
];

const NEW_HIRE: Array<[string, string]> = [
  ["Day one", "The new loan officer checks and claims an open ZIP code near their market and starts on the Free plan or a 15-day trial."],
  ["First week", "Cerebro builds a growth plan for their ZIP code and drafts local posts and Google Business Profile updates to review."],
  ["Every day after", "Borrowers who reach their pages get answers right away, and the qualified ones land with the new loan officer, with a summary."],
];

const GUARDRAILS = [
  "Cerebro never presents rates as offers, makes credit decisions or gives legal or tax advice.",
  "Every borrower conversation is handed to a licensed loan officer, never to another lender.",
  "Borrowers are asked for consent before being contacted by text or email, and texts tell them how to opt out.",
  "Each loan officer's NMLS ID belongs on the pages and marketing that promote them.",
];

const FAQ = [
  {
    q: "Is there a team discount?",
    a: "No. Each loan officer is on their own plan: Pro $99, Growth $199 or Exclusive $299 a month, each with a 15-day free trial and one ZIP code. There is no team discount today.",
  },
  {
    q: "Can two loan officers on my team share a ZIP code?",
    a: "No. Each ZIP code can be held by one YPN USA loan officer at a time, so your loan officers cover different ZIP codes instead of competing for the same borrowers.",
  },
  {
    q: "Does a ZIP code lock during the free trial?",
    a: "No. The 15-day trial lets a loan officer try the tools; the ZIP code locks when their first payment goes through. To lock it right away, they can pay now or choose a 5-year prepaid plan.",
  },
  {
    q: "Can our compliance team review how Cerebro talks to borrowers?",
    a: "Yes. Book a team walkthrough and we'll go through Cerebro's guardrails, consent handling and hand-off to your loan officers. Cerebro assists licensed loan officers; it does not replace them.",
  },
  {
    q: "Is YPN USA exclusive across all lenders?",
    a: "No. ZIP code exclusivity applies within YPN USA: no other YPN USA loan officer can claim a ZIP code your loan officer holds. Other lenders can still market in the same area.",
  },
];

export default function TeamsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${URL}#webpage`,
        url: URL,
        name: PAGE_SEO.teams.title,
        description: PAGE_SEO.teams.description,
        isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
        about: { "@id": `${URL}#service` },
      },
      {
        "@type": "Service",
        "@id": `${URL}#service`,
        name: "YPN USA for mortgage teams and branch managers",
        serviceType: "Marketing software and AI follow-up for mortgage loan officers",
        provider: { "@id": ORGANIZATION_ID },
        areaServed: { "@type": "Country", name: "United States" },
        audience: { "@type": "BusinessAudience", audienceType: "Mortgage branches, branch managers and loan officer teams" },
        offers: PAID_TIERS.map((tier) => ({
          "@type": "Offer",
          name: `${tier.name} (per loan officer)`,
          price: tier.price.replace(/[^0-9.]/g, ""),
          priceCurrency: "USD",
          url: `${MARKETING_SITE_URL}/pricing`,
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQ)) }} />

        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
            <Breadcrumbs items={homeTrail({ name: "Teams", href: PATH })} />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">
              For branch managers and mortgage teams
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              A pipeline for every loan officer on your team
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              Give each loan officer their own ZIP code, local pages and Cerebro AI follow-up from day one. Your team covers
              more ground without competing for the same borrowers, and new hires have something working for them before their
              database does.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="/consultation"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-7 py-3 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Book a team walkthrough
              </Link>
              <Link
                href="/claim-territory"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Check open ZIP codes
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">What each loan officer gets</h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {EACH_GETS.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-700">
              Want the details on the assistant?{" "}
              <Link href="/cerebro" className="font-semibold text-violet-700 underline">
                See what Cerebro does today
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14 text-slate-900 sm:py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold">Cover more ZIP codes without competing</h2>
              <p className="mt-4 text-slate-700">
                Each ZIP code can be held by one YPN USA loan officer at a time. When your loan officers each claim a different
                ZIP code, borrower inquiries from YPN USA pages for that ZIP code go to the loan officer who holds it, so your
                team isn&rsquo;t bidding against itself. Exclusivity applies within YPN USA; other lenders can still market in
                the same area.
              </p>
            </div>
            <div>
              <h2 className="text-3xl font-semibold">A faster start for new hires</h2>
              <ol className="mt-4 space-y-4">
                {NEW_HIRE.map(([title, body]) => (
                  <li key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">Guardrails your compliance team can review</h2>
            <ul className="mt-6 space-y-3 text-slate-700">
              {GUARDRAILS.map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden className="text-violet-700">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-700">
              Read our{" "}
              <Link href="/licensing-disclosures" className="font-semibold text-violet-700 underline">
                licensing &amp; disclosures
              </Link>
              . Your loan officers remain responsible for RESPA, TCPA and state licensing compliance.
            </p>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">Pricing per loan officer</h2>
            <p className="mt-3 max-w-3xl text-slate-700">
              Each loan officer is on their own plan, with a {TRIAL_DAYS}-day free trial and one ZIP code that locks at their
              first payment. There is no team discount.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {PAID_TIERS.map((tier) => (
                <li key={tier.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold text-slate-900">{tier.name}</h3>
                  <p className="mt-1 text-2xl font-bold">
                    {tier.price}
                    <span className="text-sm font-medium text-slate-600"> {tier.cadence} per loan officer</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-700">{tier.tagline}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-slate-700">
              <Link href="/pricing" className="font-semibold text-violet-700 underline">
                Compare everything each plan includes
              </Link>
              , including 5-year prepaid plans.
            </p>
          </div>
        </section>

        <section className="relative isolate overflow-hidden py-14 sm:py-16">
          <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold">Book a team walkthrough</h2>
            <p className="mt-4 text-white/85">
              Talk with David J. Moore, MBA, a loan officer for 25+ years, about your markets, which ZIP codes are open and how
              Cerebro would work for your loan officers.
            </p>
            <Link
              href="/consultation"
              className="mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-8 py-3 text-sm font-semibold text-[#09081b] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Book a team walkthrough
            </Link>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">FAQ</h2>
            <div className="mt-8 space-y-4">
              {FAQ.map((item) => (
                <details key={item.q} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <summary className="cursor-pointer font-semibold text-slate-900">{item.q}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
