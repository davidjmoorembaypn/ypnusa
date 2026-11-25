import Link from "next/link";
import type { Metadata } from "next";
import { TerritoryClaim } from "@/components/territory-claim";
import { PredictiveHomepageEngine } from "@/components/homepage/PredictiveHomepageEngine";
import { HeroVideo } from "@/components/homepage/HeroVideo";
import { HowItWorks } from "@/components/homepage/how-it-works";
import { ClientCalculatorPreview } from "@/components/homepage/client-calculator-preview";
import { FloatingAssistantLazy } from "@/components/assistant/floating-assistant-lazy";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CerebroSandbox } from "@/components/homepage/cerebro-sandbox";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { FaqAccordion } from "@/components/homepage/faq-accordion";
import { StickyZipBar } from "@/components/homepage/sticky-zip-bar";
import { MobileCollapse } from "@/components/homepage/mobile-collapse";
import { TrackedAnchor } from "@/components/homepage/tracked-anchor";
import { BTN_PRIMARY, EYEBROW, H2, LINK } from "@/components/homepage/ui";
import { YouTubeFacade } from "@/components/youtube-facade";
import { EXPLAINER_VIDEO, explainerVideoJsonLd } from "@/lib/explainer-video";
import { FOUNDER_ID, faqJsonLd, jsonLdScript, liveHeadline, marketingMetadata, softwareApplicationJsonLd } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { HOMEPAGE_HEADLINE } from "@/lib/homepage-copy";
import { AUTHOR_NAME, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";

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
      ["Works your pipeline", "Surfaces who needs a call today and follows up by email, on its own or after your approval."],
      ["Drafts your marketing", "Local posts, Google Business Profile updates and Realtor co-marketing, for you to edit."],
      ["Looks up live data", "Checks live ZIP code availability and quotes plans from the current price list."],
    ],
  },
] as const;

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

/** YPN USA vs. shared lead vendors. No vendor prices or resale counts: we have no source for a figure. */
const COMPARISON: ReadonlyArray<{ feature: string; ypn: string; shared: string }> = [
  {
    feature: "Territory Exclusivity",
    ypn: "1 MLO per ZIP code within YPN USA",
    shared: "The same lead is often sold to several lenders",
  },
  {
    feature: "24/7 AI Borrower Qualification",
    ypn: "Included: Cerebro answers and qualifies day and night",
    shared: "Usually not included; you chase the lead yourself",
  },
  {
    feature: "Co-Branded Client Calculator",
    ypn: "Included, with your name and NMLS #",
    shared: "Rarely offered",
  },
  {
    feature: "Lead Ownership Across Brokerages",
    ypn: "Your leads stay yours if you change companies",
    shared: "Often tied to the vendor or your employer's account",
  },
];

const FOUNDER_CREDENTIALS: ReadonlyArray<[string, string]> = [
  ["Experience", "25+ years as a loan officer"],
  ["Loans closed", "2,000+"],
  ["Formerly", "JPMorgan Chase and Wells Fargo"],
  ["Education", "MBA, Fresno State"],
];

const FAQ = [
  {
    q: "What is YPN USA and who is it built for?",
    a: "YPN USA is an AI mortgage marketing and lead generation platform built for licensed Mortgage Loan Officers (MLOs) who want to own their local market rather than buy shared leads. Each paid plan includes an exclusive ZIP code, a local page for it and Cerebro, an AI assistant that answers and qualifies borrowers 24/7.",
  },
  {
    q: "What is Cerebro?",
    a: "Cerebro is YPN USA's AI assistant for mortgage loan officers. On your pages it answers borrower questions 24/7, qualifies them and hands the ready ones to you. Inside your dashboard it builds your growth plan, works your pipeline and drafts your marketing. It assists you as the licensed loan officer and never replaces you.",
  },
  {
    q: "How does the exclusive ZIP code territory model work?",
    a: "Each paid plan includes one 5-digit ZIP code. It locks to you at your first payment, and while you hold it no other YPN USA loan officer can claim it, so you never compete with another YPN USA lender for that ZIP code's traffic or leads. Borrower inquiries from YPN USA pages for that ZIP code route to you. Exclusivity applies within YPN USA; other lenders can still market in your area.",
  },
  {
    q: "Do I keep my leads if I switch brokerages?",
    a: "Yes. Borrowers Cerebro captures for you are recorded under your account and stay yours on every plan, including if you move to another company.",
  },
  {
    q: "Do I still have to follow up myself?",
    a: "Yes, for everything that needs a licensed loan officer. Cerebro answers, qualifies and records conversations, emails routine follow-ups (on its own by default, or after your approval) and drafts marketing for your review. You handle every application, rate conversation and credit decision.",
  },
  {
    q: "Which loan programs does it handle?",
    a: "FHA, VA, conventional, DSCR, HELOC, refinance and jumbo, each with its own question flow, so you can serve first-time buyers, veterans and investor borrowers alike.",
  },
  {
    q: "How much does it cost to start?",
    a: "Nothing. Run Cerebro’s free growth diagnostic and preview borrower intake with no credit card. Live lead delivery starts with a paid subscription. Paid plans are Pro $99/mo, Growth $199/mo and Exclusive $299/mo, and every paid plan offers a 15-day free trial so you can try the tools. Neither the Free plan nor the trial locks a ZIP code: it locks at your first payment. Pay now, or choose a 5-year plan, to lock it today.",
  },
  {
    q: "Does YPN USA work for teams?",
    a: "Yes. Each loan officer on a team is on their own plan with their own ZIP code, so your team covers more ZIP codes without competing for the same borrowers. There is no team discount.",
  },
  {
    q: "Where is YPN USA located and what areas do you serve?",
    a: "YPN USA is headquartered at 247 N L St in Dinuba, California, and serves licensed Mortgage Loan Officers nationwide across the United States.",
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

const CARD = "rounded-3xl border border-slate-200 bg-white p-6 shadow-sm";
const SUBTLE_LINKS = "mt-4 text-sm text-slate-700";

export default function Home() {
  return (
    // pb reserves room for the sticky ZIP bar, so it never covers the last line of the footer.
    <div className="ypn-light flex min-h-full flex-col overflow-x-clip bg-slate-50 pb-[4.5rem] text-slate-900">
      <SiteHeader tone="light" />

      <main id="main-content" className="bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(HOME_WEBPAGE_JSON_LD) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareApplicationJsonLd()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQ)) }} />

      {/* HERO */}
      <section id="hero" className="relative isolate overflow-hidden border-b border-slate-200 bg-slate-50">
        <div className="relative h-48 overflow-hidden sm:h-64 lg:absolute lg:inset-0 lg:h-auto">
          <HeroVideo />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden lg:block lg:bg-[linear-gradient(90deg,rgba(248,250,252,0.95)_0%,rgba(248,250,252,0.86)_41%,transparent_65%)]"
        />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-6 px-4 py-8 sm:px-8 lg:min-h-[35rem] lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14 lg:px-14 lg:py-20">
          <div data-cerebro-avoid="" className="max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-800">
              For licensed mortgage loan officers nationwide
            </p>
            <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl lg:text-5xl">
              {liveHeadline("/") ?? HOMEPAGE_HEADLINE}{" "}
              <span className="text-violet-800">Meet your own AI assistant.</span>
            </h1>

            <p className="mt-4 max-w-md text-base leading-7 text-slate-800">
              Cerebro helps your customers while you close loans. It answers borrower questions 24/7, captures inquiry
              details, and drafts your follow-up.
            </p>
            <TrackedAnchor href="#cerebro" cta="hero_see_cerebro" className="mt-3 inline-flex min-h-11 items-center font-semibold text-slate-950 underline decoration-violet-500 underline-offset-4 hover:text-violet-800">
              See Cerebro in action
            </TrackedAnchor>
          </div>

          <div id="claim" className="relative w-full max-w-sm scroll-mt-24">
            <TerritoryClaim source="hero" />
          </div>
        </div>
      </section>

      {/* LIVE CEREBRO */}
      <section id="cerebro" className="scroll-mt-24 border-y border-slate-200 bg-slate-50 py-12 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Interactive Cerebro example</p>
            <h2 className={`mt-3 ${H2}`}>From a borrower&rsquo;s first question to your next call</h2>
            <p className="mt-4 text-slate-700">
              Pick a sample borrower scenario to see the conversation, the summary you get in your dashboard, and a drafted follow-up.
            </p>
          </div>
          <div className="mt-8">
            <CerebroSandbox />
          </div>

          <h3 className="mt-10 text-center text-2xl font-semibold text-slate-900 md:mt-14">What Cerebro does for you today</h3>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-700">
            Cerebro works for your borrowers on your pages, under your brand, and for you inside your dashboard. These features
            are live now.
          </p>
          <MobileCollapse label="See everything Cerebro does today" name="cerebro_features" className="mt-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {CEREBRO_TODAY.map((column) => (
              <div key={column.audience} className={CARD}>
                <h4 className="text-lg font-semibold text-slate-900">{column.audience}</h4>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {column.items.map(([title, body]) => (
                    <li key={title}>
                      <p className="text-sm font-semibold text-violet-900">{title}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-700">{body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          </MobileCollapse>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Programs supported:</span>
            {PROGRAMS.map((p) => (
              <span key={p} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800">
                {p}
              </span>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/cerebro" className={BTN_PRIMARY}>
              Meet Cerebro
            </Link>
            <p className={SUBTLE_LINKS}>
              Have a question first?{" "}
              <OpenAssistantButton className={LINK}>Ask Cerebro</OpenAssistantButton>
              <span aria-hidden> &middot; </span>
              <Link href="/topics/ai-lead-automation" className={LINK}>
                Mortgage CRM and AI guides
              </Link>
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <PredictiveHomepageEngine />
      </div>

      <HowItWorks />

      {/* CLIENT CALCULATOR PREVIEW */}
      <section id="calculator-preview" className="bg-white py-12 md:py-16">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Co-branded client tool</p>
            <h2 className={`mt-3 ${H2}`}>Your borrowers and Realtor partners get a calculator with your name on it</h2>
            <p className="mt-4 text-slate-700">
              Type your name and NMLS # to preview it. Once you claim a ZIP code, this payment and buying-power calculator carries
              your branding on your pages.
            </p>
          </div>
          <div className="mt-6 md:mt-10">
            <ClientCalculatorPreview source="home" />
          </div>
        </div>
      </section>

      {/* COMING TO CEREBRO */}
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className={H2}>Coming to Cerebro</h2>
          <p className="mt-3 max-w-2xl text-slate-700">In development and not available yet.</p>
          <MobileCollapse label="See what's coming (3 features in development)" name="coming_soon" className="mt-6 md:mt-8">
          <ul className="grid gap-4 md:grid-cols-3">
            {COMING_SOON.map(([title, body]) => (
              <li key={title} className="rounded-2xl border border-dashed border-slate-400 bg-slate-50 p-5">
                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-950">
                  Coming soon
                </span>
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
              </li>
            ))}
          </ul>
          </MobileCollapse>
        </div>
      </section>

      {/* YOUR ZIP CODE */}
      <section id="territories" className="border-y border-slate-200 bg-slate-50 py-12 md:py-16 lg:py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:gap-12">
          <div>
            <p className={EYEBROW}>Exclusive ZIP codes</p>
            <h2 className={`mt-3 ${H2}`}>Your ZIP code, yours alone</h2>
            <p className="mt-4 text-lg text-slate-800">
              Each paid plan includes one ZIP code. While you hold it, no other YPN USA loan officer can claim it, and borrower
              inquiries from your YPN USA pages for that ZIP code route to you.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-800">
              {[
                "One YPN USA loan officer per ZIP code",
                "First come, first served; it locks at your first payment",
                "Add neighboring ZIP codes as paid add-ons, subject to availability",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <span aria-hidden className="font-bold text-emerald-700">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <TrackedAnchor href="#claim" cta="territories_check_zip" className={`mt-6 ${BTN_PRIMARY}`}>
              Check my ZIP code
            </TrackedAnchor>
            <p className={SUBTLE_LINKS}>
              Related reading:{" "}
              <Link href="/topics/exclusive-mortgage-leads" className={LINK}>
                exclusive vs. shared mortgage leads
              </Link>
              <span aria-hidden> &middot; </span>
              <Link href="/loan-officers" className={LINK}>
                find your market
              </Link>
            </p>
          </div>

          <div>
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full table-fixed border-collapse text-left text-[13px] leading-snug sm:text-sm">
                <caption className="border-b border-slate-200 px-4 py-3 text-left text-base font-semibold text-slate-900">
                  YPN USA vs. shared lead portals
                </caption>
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[36%]" />
                  <col className="w-[34%]" />
                </colgroup>
                <thead>
                  <tr className="align-bottom">
                    <th scope="col" className="px-3 py-3 font-semibold text-slate-700 sm:px-4">
                      <span className="sr-only">Feature</span>
                    </th>
                    <th scope="col" className="bg-emerald-50 px-3 py-3 font-bold text-emerald-950 sm:px-4">
                      YPN USA
                      <span className="block text-xs font-semibold text-emerald-900">$99&ndash;$299/mo</span>
                    </th>
                    <th scope="col" className="px-3 py-3 font-bold text-slate-900 sm:px-4">
                      Shared Lead Vendors
                      <span className="block text-xs font-semibold text-slate-700">Usually priced per lead</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.feature} className="border-t border-slate-200 align-top">
                      <th scope="row" className="break-words px-3 py-3 font-semibold text-slate-900 sm:px-4">
                        {row.feature}
                      </th>
                      <td className="break-words bg-emerald-50 px-3 py-3 font-medium text-emerald-950 sm:px-4">
                        <span aria-hidden className="font-bold text-emerald-700">✓ </span>
                        {row.ypn}
                      </td>
                      <td className="break-words px-3 py-3 text-slate-800 sm:px-4">
                        <span aria-hidden className="font-bold text-slate-600">✕ </span>
                        {row.shared}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-600">
              Shared lead vendor pricing and practices vary by vendor. Exclusivity applies within YPN USA; other lenders can still
              market in your area.
            </p>
          </div>
        </div>
      </section>

      {/* TEAMS + GUARDRAILS */}
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 sm:px-6 md:gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className={EYEBROW}>For teams</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 lg:text-3xl">For managers and teams</h2>
            <p className="mt-4 text-slate-700">
              Give every loan officer on your team their own ZIP code, local pages and Cerebro follow-up from day one. Your
              loan officers cover different ZIP codes instead of competing for the same borrowers. Each loan officer is on
              their own plan, from $99 a month.
            </p>
            <Link href="/teams" className={`mt-5 inline-flex ${LINK}`}>
              YPN USA for teams
            </Link>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <p className={EYEBROW}>Guardrails</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 lg:text-3xl">What Cerebro never does</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {NEVER.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <span aria-hidden className="font-bold text-rose-700">✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-slate-700">
              Cerebro assists licensed loan officers; it does not replace one. Every borrower conversation is handed to you,
              the licensed MLO. Scoring and qualification are informational; see our{" "}
              <Link href="/licensing-disclosures" className={LINK}>
                licensing &amp; disclosures
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* PLANS AND ROI */}
      <section id="pricing" className="border-y border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className={EYEBROW}>Pricing</p>
            <h2 className={`mt-3 ${H2}`}>Choose how to get started</h2>
            <p className="mt-4 text-slate-700">
              Paid plans start at $99 per month and include one exclusive ZIP code within YPN USA.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">$0 Free plan</h3>
              <p className="my-3 text-sm text-slate-700">Run the growth diagnostic and preview borrower intake. No card required. Live lead delivery starts with a paid subscription.</p>
              <Link href={FREE_SIGNUP_HREF} className={LINK}>Start free</Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">15-day paid-plan trial</h3>
              <p className="my-3 text-sm text-slate-700">Try the paid tools for 15 days. Your ZIP code locks at your first payment.</p>
              <Link href="/pricing#paid-plans" className={LINK}>Choose a plan to try</Link>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="text-lg font-semibold text-slate-900">Lock your ZIP code</h3>
              <p className="my-3 text-sm text-slate-700">Check availability, then make your first payment to lock the ZIP code you choose.</p>
              <TrackedAnchor href="#claim" cta="pricing_pay_now_zip" className={LINK}>Check your ZIP code</TrackedAnchor>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-slate-700">
            <Link href="/pricing" className={LINK}>
              Compare every plan
            </Link>
            <span aria-hidden> &middot; </span>
            <Link href="/roi" className={LINK}>
              Full ROI calculator
            </Link>
            <span aria-hidden> &middot; </span>
            <TrackedAnchor href="#claim" cta="pricing_check_zip" className={LINK}>
              Check your ZIP code first
            </TrackedAnchor>
          </p>
        </div>
      </section>

      {/* BUILT BY A LOAN OFFICER (+ explainer video) */}
      <section id="how-it-works-video" className="bg-white py-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(explainerVideoJsonLd()) }} />
        <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
          <figure>
            <YouTubeFacade videoId={EXPLAINER_VIDEO.id} title={EXPLAINER_VIDEO.title} tone="light" />
            <figcaption className="mt-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-900">Watch: {EXPLAINER_VIDEO.title}.</span> David explains why holding a
              ZIP code that is exclusive within YPN USA beats renting clicks and shared leads.
            </figcaption>
          </figure>
          <div>
            <p className={EYEBROW}>Built by a loan officer</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 lg:text-3xl">Built by a 25-year loan officer</h2>
            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <p className="text-lg font-semibold text-slate-900">{AUTHOR_NAME}</p>
              <p className="text-sm text-slate-700">Founder, YPN USA</p>
              <dl className="mt-4 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                {FOUNDER_CREDENTIALS.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-slate-700">{label}</dt>
                    <dd className="font-semibold text-slate-900">{value}</dd>
                  </div>
                ))}
                <div className="contents">
                  <dt className="text-slate-700">Licenses</dt>
                  <dd className="font-semibold text-slate-900">
                    NMLS #{NMLS_ID} &middot; California DRE #{CA_DRE_ID}
                  </dd>
                </div>
              </dl>
              <a
                href={NMLS_CONSUMER_ACCESS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-4 inline-flex min-h-[32px] items-center text-sm ${LINK}`}
              >
                Verify on NMLS Consumer Access
              </a>
            </div>
            <Link href="/consultation" className={`mt-6 ${BTN_PRIMARY}`}>
              Talk to the founder
            </Link>
            <p className={SUBTLE_LINKS}>
              <Link href="/about" className={LINK}>
                About David
              </Link>
              <span aria-hidden> &middot; </span>
              Free guides:{" "}
              <Link href="/blog/mortgage-lead-channels-ranked-for-2026" className={LINK}>
                mortgage lead channels ranked
              </Link>
              ,{" "}
              <Link href="/topics/loan-officer-marketing" className={LINK}>
                loan officer marketing
              </Link>{" "}
              and{" "}
              <Link href="/topics/local-seo-for-loan-officers" className={LINK}>
                local SEO for loan officers
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 bg-slate-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
          <h2 className={`text-center ${H2}`}>Questions loan officers ask</h2>
          <div className="mt-10">
            <FaqAccordion items={FAQ} />
          </div>
          <div className="mt-10 text-center">
            <TrackedAnchor href="#claim" cta="faq_check_zip" className={`${BTN_PRIMARY} min-h-[52px] px-8 text-base`}>
              Check my ZIP code
            </TrackedAnchor>
          </div>
        </div>
      </section>
      </main>

      <SiteFooter tone="light" />

      <StickyZipBar heroId="hero" />

      <FloatingAssistantLazy />
    </div>
  );
}
