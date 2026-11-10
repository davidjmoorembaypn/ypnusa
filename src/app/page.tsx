import Link from "next/link";
import type { Metadata } from "next";
import { TerritoryClaim } from "@/components/territory-claim";
import { PredictiveHomepageEngine } from "@/components/homepage/PredictiveHomepageEngine";
import { HeroVideo } from "@/components/homepage/HeroVideo";
import { FloatingAssistantLazy } from "@/components/assistant/floating-assistant-lazy";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { PricingCta } from "@/components/pricing-cta";
import { YouTubeFacade } from "@/components/youtube-facade";
import { EXPLAINER_VIDEO, explainerVideoJsonLd } from "@/lib/explainer-video";
import { FOUNDER_ID, faqJsonLd, jsonLdScript, marketingMetadata, softwareApplicationJsonLd } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { AUTHOR_NAME, CA_DRE_ID, NMLS_ID } from "@/lib/author";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.home, path: "/", absoluteTitle: true });
}

/** Only what Cerebro does today; anything not live belongs in COMING_SOON. */
const CEREBRO_TODAY = [
  {
    audience: "For your borrowers",
    items: [
      ["Answers questions 24/7", "Explains programs and next steps in plain language, any hour, on your pages."],
      ["Qualifies the inquiry", "Captures goal, timeline, price range and contact details, with consent."],
      ["Records the conversation", "Everything the borrower said is saved, so your first call doesn't start from zero."],
      ["Hands off to you", "Routes ready borrowers to you with a summary, never to another lender."],
    ],
  },
  {
    audience: "For you, the loan officer",
    items: [
      ["Builds your growth plan", "Tell it your market and your biggest challenge; it maps the next steps for your ZIP code."],
      ["Works your pipeline", "Surfaces who needs a call today and drafts the follow-up for your review."],
      ["Drafts your marketing", "Local posts, Google Business Profile updates and Realtor co-marketing, for you to edit."],
      ["Looks up live data", "Checks live ZIP code availability and quotes plans from the current price list."],
    ],
  },
] as const;

const DAY_ON_AUTOPILOT: Array<[string, string]> = [
  ["9:42 PM", "A borrower on your page asks whether they can buy with a small down payment. Cerebro explains the basics in plain language and asks a few qualifying questions."],
  ["9:47 PM", "They share their timeline, price range and area, and agree to be contacted. Cerebro records the conversation and routes it to you."],
  ["7:30 AM", "You open your dashboard and see the summary, plus who else needs a call today."],
  ["8:15 AM", "You call a borrower who already knows the basics. A local post Cerebro drafted is waiting for your review."],
];

const COMING_SOON: Array<[string, string]> = [
  ["Done-for-you Google profile setup", "Cerebro setting up and filling in your Google Business Profile for you."],
  ["Local Visibility Score", "How visible you are in local search for your ZIP code, and what to fix first."],
  ["Multi-task agentic mode", "Cerebro working through several tasks in a row, with you approving each result."],
];

const NEVER = [
  "Offer or lock rates",
  "Make credit decisions",
  "Give legal or tax advice",
  "Send a borrower to another lender",
];

const PROGRAMS = ["FHA", "VA", "Conventional", "DSCR", "HELOC", "Refinance", "Jumbo"];

const FAQ = [
  {
    q: "What is Cerebro?",
    a: "Cerebro is YPN USA's AI assistant for mortgage loan officers. On your pages it answers borrower questions 24/7, qualifies them and hands the ready ones to you. Inside your dashboard it builds your growth plan, works your pipeline and drafts your marketing. It assists you as the licensed loan officer and never replaces you.",
  },
  {
    q: "What does an exclusive ZIP code mean?",
    a: "Each paid plan includes one ZIP code. While you hold it, no other YPN USA loan officer can claim it, and borrower inquiries from YPN USA pages for that ZIP code route to you. Exclusivity applies within YPN USA; other lenders can still market in your area.",
  },
  {
    q: "Do I keep my leads if I switch brokerages?",
    a: "Yes. Borrowers Cerebro captures for you are recorded under your account and stay yours on every plan, including if you move to another company.",
  },
  {
    q: "Do I still have to follow up myself?",
    a: "Yes, for everything that needs a licensed loan officer. Cerebro answers, qualifies and records conversations and drafts follow-up and marketing for your review. You handle every application, rate conversation and credit decision.",
  },
  {
    q: "Which loan programs does it handle?",
    a: "FHA, VA, conventional, DSCR, HELOC, refinance and jumbo, each with its own question flow, so you can serve first-time buyers, veterans and investor borrowers alike.",
  },
  {
    q: "How much does it cost to start?",
    a: "Nothing. Run Cerebro, our free AI growth diagnostic, plus the AI intake assistant, with no credit card. Paid plans are Pro $99/mo, Growth $199/mo and Exclusive $299/mo, and every paid plan offers a 15-day free trial so you can try the tools. Neither the Free plan nor the trial locks a ZIP code: it locks at your first payment. Pay now, or choose a 5-year plan, to lock it today.",
  },
  {
    q: "Does YPN USA work for teams?",
    a: "Yes. Each loan officer on a team is on their own plan with their own ZIP code, so your team covers more ZIP codes without competing for the same borrowers. There is no team discount.",
  },
];

/** WebPage node for the homepage, tied to the site-wide Organization and WebSite nodes in layout.tsx. */
const HOME_WEBPAGE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${MARKETING_SITE_URL}/#webpage`,
  url: `${MARKETING_SITE_URL}/`,
  name: PAGE_SEO.home.title,
  description: PAGE_SEO.home.description,
  isPartOf: { "@id": `${MARKETING_SITE_URL}/#website` },
  about: { "@id": `${MARKETING_SITE_URL}/#app` },
  author: { "@type": "Person", "@id": FOUNDER_ID, name: AUTHOR_NAME },
  primaryImageOfPage: { "@type": "ImageObject", url: `${MARKETING_SITE_URL}/assets/hero/hero-poster-v1-1600.webp` },
  inLanguage: "en-US",
};

const H2 = "text-3xl font-semibold lg:text-4xl";
const EYEBROW_DARK = "text-xs font-semibold uppercase tracking-[0.3em] text-violet-200";
const EYEBROW_LIGHT = "text-xs font-semibold uppercase tracking-[0.3em] text-violet-700";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-[#09081b] pb-24 text-white md:pb-0">
      <SiteHeader />

      <main id="main-content">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(HOME_WEBPAGE_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareApplicationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQ)) }} />

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <HeroVideo />
        <div className="ypn-hero-scrim pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:py-24">
          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              For licensed mortgage loan officers
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-[3.4rem]">
              Meet Cerebro: the AI that works your borrowers <span className="text-violet-300">while you close loans.</span>
            </h1>
            <p className="mt-5 text-lg text-white/90">
              Cerebro answers and qualifies every borrower who reaches your pages, day or night, then hands you the ready
              ones. Pair it with an exclusive ZIP code, and the mortgage lead generation you build in your market comes to
              you, not to another YPN USA loan officer.
            </p>

            <div className="mt-7 flex flex-wrap gap-4 text-sm font-semibold">
              <a
                href="#territories"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Check your ZIP code — free
              </a>
              <OpenAssistantButton className="inline-flex items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-white shadow-xl shadow-violet-900/40 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">
                Talk to Cerebro
              </OpenAssistantButton>
              <PricingCta
                tierId="growth"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-white backdrop-blur transition duration-200 hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Start 15-day free trial · Pro $99/mo
              </PricingCta>
            </div>
            <p className="mt-3 text-xs text-white/70">
              Built by licensed loan officer {AUTHOR_NAME} · NMLS #{NMLS_ID} · CA DRE #{CA_DRE_ID}
            </p>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-white/70">
              {["Free to start", "Free plan needs no card", "15-day trial on paid plans"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-emerald-400">✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                ["24/7", "Borrower answers"],
                ["1 per ZIP code", "YPN USA loan officer"],
                ["15 days", "Free trial, paid plans"],
              ].map(([stat, label]) => (
                <div key={label} className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/15">
                  <dt className="text-xl font-bold text-violet-200">{stat}</dt>
                  <dd className="text-[11px] uppercase tracking-wide text-white/70">{label}</dd>
                </div>
              ))}
            </dl>

            <PredictiveHomepageEngine />
          </div>

          <div className="w-full lg:max-w-md">
            <TerritoryClaim source="hero" />
            <p className="mt-3 text-center text-xs text-white/70">
              Checking availability is free &mdash; your ZIP code locks at your first payment.{" "}
              <Link href="/pricing" className="font-semibold text-violet-200 underline hover:text-white">
                Plans from $99/mo
              </Link>
              : pay now to lock it today, or try the tools free for 15 days first.
            </p>
          </div>
        </div>
      </section>

      {/* WHAT CEREBRO DOES TODAY */}
      <section id="cerebro" className="border-b border-white/10 bg-[#0d0b26] py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW_DARK}>Meet Cerebro</p>
            <h2 className={`mt-3 text-white ${H2}`}>What Cerebro does for you today</h2>
            <p className="mt-4 text-white/80">
              Cerebro works for your borrowers on your pages, under your brand, and for you inside your dashboard. These
              features are live now.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {CEREBRO_TODAY.map((column) => (
              <div key={column.audience} className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/15">
                <h3 className="text-lg font-semibold text-white">{column.audience}</h3>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {column.items.map(([title, body]) => (
                    <li key={title}>
                      <p className="text-sm font-semibold text-violet-100">{title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/75">{body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold">
            <Link
              href="/cerebro"
              className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-7 py-3 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Meet Cerebro
            </Link>
            <Link href="/topics/ai-lead-automation" className="text-violet-200 underline underline-offset-4 hover:text-white">
              Mortgage CRM and AI guides
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-white/70">Programs supported:</span>
            {PROGRAMS.map((p) => (
              <span key={p} className="rounded-full border border-white/25 px-3 py-1 text-xs font-semibold text-white/85">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* A DAY ON AUTOPILOT */}
      <section className="bg-white py-16 text-slate-900">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <h2 className={H2}>
            A day on autopilot <span className="text-xl font-medium text-slate-600 lg:text-2xl">(illustration)</span>
          </h2>
          <ol className="mt-8 space-y-4">
            {DAY_ON_AUTOPILOT.map(([time, body]) => (
              <li key={time} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-[90px_1fr]">
                <span className="font-mono text-sm font-semibold text-violet-800">{time}</span>
                <p className="text-sm leading-relaxed text-slate-700">{body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-600">
            An illustration of how a day can look, not a real borrower and not a promise of leads or loans.
          </p>
        </div>
      </section>

      {/* COMING TO CEREBRO */}
      <section className="border-t border-slate-200 bg-slate-50 py-16 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className={H2}>Coming to Cerebro</h2>
          <p className="mt-3 max-w-2xl text-slate-700">In development and not available yet.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {COMING_SOON.map(([title, body]) => (
              <li key={title} className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                  Coming soon
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* YOUR ZIP CODE */}
      <section id="territories" className="relative isolate overflow-hidden bg-[#09081b] py-20">
        <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-80" aria-hidden />
        <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Exclusive ZIP codes
            </span>
            <h2 className={H2}>Your ZIP code, yours alone</h2>
            <p className="text-lg text-white/85">
              Each paid plan includes one ZIP code. While you hold it, no other YPN USA loan officer can claim it, and
              borrower inquiries from your YPN USA pages for that ZIP code route to you. No lead resold to five competitors,
              no race to dial first.
            </p>
            <ul className="space-y-3 text-sm text-white/90">
              {[
                "One YPN USA loan officer per ZIP code",
                "First come, first served; it locks at your first payment",
                "Add neighboring ZIP codes as paid add-ons, subject to availability",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/15">
                  <span aria-hidden className="text-amber-300">◆</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-sm text-white/75">
              Exclusivity applies within YPN USA; other lenders can still market in your area. Compare{" "}
              <Link href="/topics/exclusive-mortgage-leads" className="font-semibold text-violet-200 underline hover:text-white">
                exclusive mortgage leads
              </Link>{" "}
              with shared ones, or{" "}
              <Link href="/loan-officers" className="font-semibold text-violet-200 underline hover:text-white">
                find your market
              </Link>
              .
            </p>
          </div>

          <TerritoryClaim source="territory_section" />
        </div>
      </section>

      {/* TEAMS + GUARDRAILS */}
      <section className="bg-white py-16 text-slate-900">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 p-6 sm:p-8">
            <p className={EYEBROW_LIGHT}>For teams</p>
            <h2 className="mt-3 text-2xl font-semibold lg:text-3xl">For managers and teams</h2>
            <p className="mt-4 text-slate-700">
              Give every loan officer on your team their own ZIP code, local pages and Cerebro follow-up from day one. Your
              loan officers cover different ZIP codes instead of competing for the same borrowers. Each loan officer is on
              their own plan, from $99 a month.
            </p>
            <Link href="/teams" className="mt-5 inline-flex font-semibold text-violet-700 underline underline-offset-4 hover:text-violet-900">
              YPN USA for teams
            </Link>
          </div>
          <div className="rounded-3xl bg-[#09081b] p-6 text-white sm:p-8">
            <p className={EYEBROW_DARK}>Guardrails</p>
            <h2 className="mt-3 text-2xl font-semibold lg:text-3xl">What Cerebro never does</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {NEVER.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-white/90">
                  <span aria-hidden className="text-amber-300">✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-white/75">
              Cerebro assists licensed loan officers; it does not replace one. Every borrower conversation is handed to you,
              the licensed MLO. Scoring and qualification are informational; see our{" "}
              <Link href="/licensing-disclosures" className="underline hover:text-white">
                licensing &amp; disclosures
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* PLANS AND ROI */}
      <section id="pricing" className="border-t border-slate-200 bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW_LIGHT}>Pricing</p>
            <h2 className={`mt-3 ${H2}`}>Plans and ROI</h2>
            <p className="mt-4 text-slate-700">
              Start free. Check your ZIP code free, then lock it with your first payment on any paid plan.{" "}
              <Link href="/roi" className="font-semibold text-violet-700 underline">
                See how many extra loans cover a plan
              </Link>
              .
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {PUBLIC_PRICING_TIERS.map((tier) => (
              <article
                key={tier.id}
                className={`flex min-h-full flex-col rounded-3xl border p-6 transition duration-200 hover:-translate-y-1 md:p-8 ${
                  tier.highlight
                    ? "border-violet-400 bg-[#09081b] text-white shadow-2xl shadow-violet-500/20 ring-2 ring-violet-400/40"
                    : "border-slate-200 bg-white text-slate-900 shadow-sm"
                }`}
              >
                {tier.highlight ? (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#09081b]">
                    Most popular
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className={`mt-1 text-sm ${tier.highlight ? "text-white/75" : "text-slate-600"}`}>{tier.tagline}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className={`pb-1 text-sm ${tier.highlight ? "text-white/75" : "text-slate-600"}`}>{tier.cadence}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span aria-hidden className={tier.highlight ? "text-amber-300" : "text-violet-700"}>✓</span>
                      <span className={tier.highlight ? "text-white/90" : "text-slate-700"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <PricingCta
                  tierId={tier.id}
                  className={`mt-8 inline-flex min-h-[48px] items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 ${
                    tier.highlight
                      ? "bg-amber-400 text-[#09081b] shadow-lg shadow-amber-500/30"
                      : "bg-[#09081b] text-white"
                  }`}
                >
                  {tier.cta}
                </PricingCta>
                <a
                  href="#territories"
                  className={`mt-3 text-center text-xs font-semibold underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 ${
                    tier.highlight ? "text-white/80 focus-visible:ring-violet-300" : "text-violet-700 focus-visible:ring-violet-500"
                  }`}
                >
                  Check your ZIP code first
                </a>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-700">
            {["Free plan — no credit card", "Cancel anytime", "5-year prepaid plans available"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span aria-hidden className="text-emerald-700">✓</span>
                {item}
              </span>
            ))}
          </div>
          <p className="mt-4 text-center text-sm">
            <Link href="/pricing" className="font-semibold text-violet-700 underline">
              Compare every plan
            </Link>{" "}
            <span className="text-slate-600">·</span>{" "}
            <Link href="/claim-territory" className="font-semibold text-violet-700 underline">
              Claim your ZIP code
            </Link>
          </p>
        </div>
      </section>

      {/* BUILT BY A LOAN OFFICER (+ explainer video) */}
      <section id="how-it-works-video" className="border-y border-white/10 bg-[#0b0a20] py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(explainerVideoJsonLd()) }} />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <YouTubeFacade videoId={EXPLAINER_VIDEO.id} title={EXPLAINER_VIDEO.title} />
          <div>
            <p className={EYEBROW_DARK}>Built by a loan officer</p>
            <h2 className="mt-2 text-2xl font-semibold text-white lg:text-3xl">Built by a 25-year loan officer</h2>
            <p className="mt-3 text-white/80">
              {AUTHOR_NAME} closed 2,000+ loans over 25+ years, formerly with JPMorgan Chase and Wells Fargo, and holds a
              Fresno State MBA. NMLS #{NMLS_ID} · California DRE #{CA_DRE_ID}. In the video, he explains why owning your
              local ZIP code beats renting clicks and shared leads.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
              <Link
                href="/consultation"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-[#09081b] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Talk to the founder
              </Link>
              <Link href="/about" className="inline-flex min-h-[48px] items-center text-violet-200 underline underline-offset-4 hover:text-white">
                About David
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/75">
              Free guides:{" "}
              <Link href="/blog/mortgage-lead-channels-ranked-for-2026" className="text-violet-200 underline hover:text-white">
                mortgage lead channels ranked
              </Link>
              ,{" "}
              <Link href="/topics/loan-officer-marketing" className="text-violet-200 underline hover:text-white">
                loan officer marketing
              </Link>{" "}
              and{" "}
              <Link href="/topics/local-seo-for-loan-officers" className="text-violet-200 underline hover:text-white">
                local SEO for loan officers
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20 text-slate-900">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <h2 className={`text-center ${H2}`}>Questions loan officers ask</h2>
          <div className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <details key={item.q} className="group rounded-2xl border border-slate-200 bg-white p-5 [&_summary]:cursor-pointer">
                <summary className="flex items-center justify-between text-base font-semibold text-slate-900 marker:content-none">
                  {item.q}
                  <span aria-hidden className="ml-4 text-violet-700 transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{item.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 text-center">
            <a
              href="#territories"
              className="inline-flex items-center justify-center rounded-full bg-[#09081b] px-8 py-4 text-base font-semibold text-white transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Check your ZIP code
            </a>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter />

      {/* Mobile sticky conversion bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[#09081b]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <a
          href="#territories"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-[#09081b] shadow-lg shadow-amber-500/30 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        >
          Check your ZIP code — free
        </a>
      </div>

      <FloatingAssistantLazy />
    </div>
  );
}
