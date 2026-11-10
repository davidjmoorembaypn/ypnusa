import type { Metadata } from "next";
import { SiloNav } from "@/components/silo-nav";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MortgageCalculator } from "@/components/mortgage-calculator";
import { marketingMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { MARKETING_SITE_URL } from "@/lib/site";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";

export async function generateMetadata(): Promise<Metadata> {
  const origin = MARKETING_SITE_URL;
  return marketingMetadata({
    ...PAGE_SEO.features,
    absoluteTitle: true,
    path: "/features",
    origin,
  });
}

const DEEP_DIVES = [
  {
    tag: "ZIP code",
    title: "One ZIP code. One YPN USA loan officer. No bidding war.",
    body: "Every borrower inquiry generated through your YPN USA pages and campaigns for your ZIP code routes to you. Claim a ZIP code first come, first served, add neighboring ZIP codes as paid add-ons, and stop splitting leads five ways. Exclusivity applies within YPN USA.",
    bullets: [
      "One YPN USA loan officer per ZIP code",
      "Locks at your first payment; first come, first served",
      "Add neighboring ZIP codes as paid add-ons, subject to availability",
      "Territory demand reports show local activity",
    ],
  },
  {
    tag: "Cerebro AI",
    title: "An AI assistant that answers, qualifies and follows up for you",
    body: "Not a script or an FAQ box. Cerebro takes action in the conversation: it looks up live data, records what a borrower tells it, and moves them to the next step.",
    bullets: [
      "Checks ZIP code availability live, while chatting",
      "Answers pricing from the current plans, never guesses",
      "Qualifies and books — captures intent, offers times, books the meeting",
      "Hands off to a human by phone when the conversation calls for one",
    ],
  },
  {
    tag: "Intake & scoring",
    title: "Captures and qualifies every program, every time",
    body: "A conversational AI greets visitors 24/7, adapts its questions to FHA, VA, conventional, DSCR, HELOC, refi, or jumbo, and scores credit posture, income, intent, and urgency in real time.",
    bullets: [
      "FHA, VA, Conventional, DSCR, HELOC, Refinance, Jumbo flows",
      "Tire-kickers get nurtured; prime borrowers get flagged the moment they're hot",
      "Confirmation email + SMS acknowledgment fire automatically",
      "Multi-day nurture ladder — no borrower waits hours for a callback",
    ],
  },
  {
    tag: "Ownership",
    title: "Your leads follow your career, not your employer",
    body: "Most MLOs lose their pipeline every time they move. With YPN USA, borrowers Cerebro captures for you are recorded under your account and stay yours on every plan, and the portable MLO website on Growth and Exclusive is tied to you, not your brokerage.",
    bullets: [
      "Change brokerages and the borrowers you captured stay in your account",
      "Portable MLO website on Growth and Exclusive",
      "No lead sharing, no reselling, no competing against yourself",
    ],
  },
  {
    tag: "Predictive intelligence",
    title: "Find motivated borrowers before the listing hits",
    body: "Where supported data is available, YPN USA organizes public-record life-event signals in your territory to help identify timely financing conversations — probate, divorce, and new-union homebuyer signals among them.",
    bullets: [
      "Probate & estate financing signals",
      "Divorce & refinance signals",
      "New-union homebuyer signals",
      "Availability, permitted use, and freshness vary by county and plan",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-6 py-16 text-center sm:py-20">
            <Breadcrumbs items={homeTrail({ name: "Features", href: "/features" })} className="mb-8 flex justify-center" />
            <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
              Everything included
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              An AI assistant that answers, qualifies and follows up for you
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
              An exclusive ZIP code within YPN USA, local pages built to rank, and Cerebro AI intake and follow-up that
              works around the clock while you close loans. See{" "}
              <Link href="/cerebro" className="font-semibold text-violet-200 underline hover:text-white">
                what Cerebro does today
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-sm font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                See pricing
              </Link>
              <OpenAssistantButton className="inline-flex items-center justify-center rounded-full bg-violet-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-violet-900/40 transition duration-200 hover:-translate-y-0.5 hover:bg-violet-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">
                Talk to Cerebro
              </OpenAssistantButton>
            </div>
          </div>
        </section>

        {DEEP_DIVES.map((feature, i) => (
          <section key={feature.title} className={i % 2 === 0 ? "bg-white py-16 text-slate-900 sm:py-20" : "bg-[#0d0b26] py-16 sm:py-20"}>
            <div className="mx-auto w-full max-w-5xl px-6">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  i % 2 === 0 ? "bg-violet-100 text-violet-700" : "bg-violet-500/20 text-violet-200"
                }`}
              >
                {feature.tag}
              </span>
              <h2 className={`mt-4 max-w-2xl text-3xl font-semibold lg:text-4xl ${i % 2 === 0 ? "" : "text-white"}`}>
                {feature.title}
              </h2>
              <p className={`mt-4 max-w-2xl ${i % 2 === 0 ? "text-slate-700" : "text-white/80"}`}>{feature.body}</p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {feature.bullets.map((b) => (
                  <li
                    key={b}
                    className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ring-1 ${
                      i % 2 === 0 ? "bg-slate-50 text-slate-700 ring-slate-200" : "bg-white/5 text-white/85 ring-white/15"
                    }`}
                  >
                    <span aria-hidden className={i % 2 === 0 ? "text-violet-700" : "text-amber-300"}>✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        {/* CALCULATOR */}
        <section className="bg-white py-16 text-slate-900 sm:py-20">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-600">Engage on contact</p>
              <h2 className="mt-3 text-3xl font-semibold lg:text-4xl">A live calculator borrowers can&apos;t ignore</h2>
              <p className="mt-4 text-slate-600">
                Every YPN USA site ships with a live payment calculator that keeps borrowers engaged
                while they model a loan on your territory.
              </p>
            </div>
            <div className="mt-12">
              <MortgageCalculator />
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-6 pb-16">
          <SiloNav silo="growth" currentPath="/features" />
        </div>

        {/* FINAL CTA */}
        <section className="relative isolate overflow-hidden bg-[#09081b] py-20">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
            <h2 className="text-3xl font-semibold lg:text-4xl">See it running on your own territory.</h2>
            <p className="mt-4 text-lg text-white/85">
              Check your ZIP code free, then let Cerebro answer the borrowers it brings in.
            </p>
            <Link
              href="/#territories"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-4 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
              Check your ZIP code — free
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
