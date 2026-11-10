import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { FloatingAssistantLazy } from "@/components/assistant/floating-assistant-lazy";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { faqJsonLd, jsonLdScript, marketingMetadata, softwareApplicationJsonLd } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { homeTrail } from "@/lib/seo/breadcrumbs";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.cerebro, absoluteTitle: true, path: "/cerebro" });
}

/** Only what Cerebro does today. Anything not live yet belongs in COMING_SOON. */
const TODAY: Array<[string, string]> = [
  [
    "Answers borrowers 24/7",
    "On your site, under your brand, Cerebro explains programs and next steps in plain language at any hour, so a 9 PM question gets an answer at 9 PM.",
  ],
  [
    "Qualifies and hands off",
    "It asks what you would ask: purchase or refinance, timeline, price range, area and how to reach them, with consent. Ready borrowers go to you with a summary.",
  ],
  [
    "Looks up live data",
    "It checks live ZIP code availability and quotes YPN USA plans from the current price list instead of guessing.",
  ],
  [
    "Records every conversation",
    "What the borrower said is saved to your account, so your first call starts where the conversation left off, not from zero.",
  ],
  [
    "Builds your growth plan",
    "Tell it your market and your biggest challenge, and it maps out next steps for your ZIP code.",
  ],
  [
    "Drafts your marketing",
    "Local social posts, Google Business Profile updates and Realtor co-marketing copy, written for you to review and edit before anything goes out.",
  ],
];

const HANDOFF_STEPS: Array<[string, string]> = [
  ["A borrower asks a question", "On your page or website, at any hour. Cerebro answers right away."],
  ["Cerebro qualifies the inquiry", "Goal, timeline, price range, area and contact details, with the borrower's consent."],
  ["You get the hand-off", "The borrower and a summary of the conversation are routed to you, the licensed loan officer, never to another lender."],
  ["You take it from there", "Every application, rate and credit decision is yours. Cerebro's job ends where licensed advice begins."],
];

const DASHBOARD: Array<[string, string]> = [
  ["Growth plan", "A plan for your ZIP code, built from what you tell Cerebro about your market and goals."],
  ["Pipeline", "Who reached out, what they asked and who needs a call today, with follow-up drafted for your review."],
  ["Marketing drafts", "Posts and profile updates ready to edit and publish, so you're never starting from a blank page."],
];

const NEVER = [
  "Offer or lock rates. It can explain how programs work, but it never presents a rate as an offer.",
  "Make credit decisions. Qualifying questions help you prepare; approval is always a licensed decision.",
  "Give legal or tax advice. It points borrowers to you or a qualified professional instead.",
  "Keep a borrower from you. Every conversation is handed to you, the licensed loan officer.",
];

const COMING_SOON: Array<[string, string]> = [
  ["Done-for-you Google profile setup", "Cerebro setting up and filling in your Google Business Profile for you."],
  ["Local Visibility Score", "A simple score for how visible you are in local search in your ZIP code, with what to fix first."],
  ["Multi-task agentic mode", "Cerebro working through several tasks in a row on its own, with you approving each result."],
];

const FAQ = [
  {
    q: "What is Cerebro?",
    a: "Cerebro is the AI assistant inside YPN USA, built for mortgage loan officers. On your site it answers borrower questions 24/7, qualifies them and hands the ready ones to you. Inside your dashboard it builds your growth plan, works your pipeline and drafts your marketing.",
  },
  {
    q: "Does Cerebro replace a loan officer?",
    a: "No. Cerebro assists you; it does not replace you. It never quotes rates as offers, makes credit decisions or gives legal or tax advice, and every borrower conversation is handed to you, the licensed loan officer.",
  },
  {
    q: "Do I need a CRM too?",
    a: "Many loan officers use both. A CRM keeps your long-term database and pipeline; Cerebro is the front door that answers and qualifies new borrowers right away. If you already use a CRM you like, keep it.",
  },
  {
    q: "How much does Cerebro cost?",
    a: "You can try Cerebro free, with no credit card. Paid plans are Pro $99, Growth $199 and Exclusive $299 a month, each with a 15-day free trial and one exclusive ZIP code within YPN USA that locks at your first payment.",
  },
  {
    q: "Which features are coming soon?",
    a: "Done-for-you Google profile setup, a Local Visibility Score and a multi-task agentic mode are in development and not available yet. This page lists only what Cerebro does today as live features.",
  },
];

export default function CerebroPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareApplicationJsonLd()) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(FAQ)) }} />

        <section className="relative isolate overflow-hidden">
          <div className="ypn-aurora pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative z-10 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
            <Breadcrumbs items={homeTrail({ name: "Cerebro", href: "/cerebro" })} />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.28em] text-violet-200">AI for loan officers</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.08] lg:text-5xl">
              Cerebro, the AI assistant for mortgage loan officers
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-white/85">
              Cerebro answers your borrowers&rsquo; questions day or night, qualifies them, records every conversation and
              hands the ready ones to you. Inside your dashboard it builds your growth plan and drafts your marketing. You stay
              the licensed loan officer; Cerebro does the waiting and the first round of questions.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
              <OpenAssistantButton className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-7 py-3 text-[#09081b] shadow-xl shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                Talk to Cerebro now
              </OpenAssistantButton>
              <a
                href={FREE_SIGNUP_HREF}
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                Start free, no card
              </a>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">What Cerebro does today</h2>
            <p className="mt-3 max-w-2xl text-slate-700">Live in YPN USA now. Plan limits apply; see pricing for what each plan includes.</p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TODAY.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">How Cerebro hands borrowers to you</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {HANDOFF_STEPS.map(([title, body], index) => (
                <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-white py-14 text-slate-900 sm:py-16">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-semibold">Inside your dashboard</h2>
              <ul className="mt-6 space-y-4">
                {DASHBOARD.map(([title, body]) => (
                  <li key={title}>
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-slate-700">
                Already use a CRM? Keep it. Read{" "}
                <Link href="/blog/mortgage-crm-vs-ai-assistant" className="font-semibold text-violet-700 underline">
                  mortgage CRM vs AI assistant
                </Link>{" "}
                for how the two fit together, or browse our{" "}
                <Link href="/topics/ai-lead-automation" className="font-semibold text-violet-700 underline">
                  mortgage CRM and AI automation guides
                </Link>
                .
              </p>
            </div>
            <div className="rounded-3xl bg-[#09081b] p-6 text-white sm:p-8">
              <h2 className="text-2xl font-semibold">What Cerebro never does</h2>
              <ul className="mt-5 space-y-3 text-sm leading-relaxed text-white/85">
                {NEVER.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span aria-hidden className="text-amber-300">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-white/70">
                Scoring and qualification are informational. See our{" "}
                <Link href="/licensing-disclosures" className="underline hover:text-white">
                  licensing &amp; disclosures
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-14 text-slate-900 sm:py-16">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-semibold">Coming soon</h2>
            <p className="mt-3 max-w-2xl text-slate-700">
              In development and not available yet. We&rsquo;ll mark each one live here when it ships.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {COMING_SOON.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
                  <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    Coming soon
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative isolate overflow-hidden py-14 sm:py-16">
          <div className="ypn-aurora pointer-events-none absolute inset-0 opacity-70" aria-hidden />
          <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold">Try Cerebro free</h2>
            <p className="mt-4 text-white/85">
              Start on the Free plan with no credit card. When you want an exclusive ZIP code, paid plans start at $99 a month
              with a 15-day free trial. Running a team? See{" "}
              <Link href="/teams" className="font-semibold text-violet-200 underline hover:text-white">
                YPN USA for teams
              </Link>
              .
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-semibold">
              <OpenAssistantButton className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-7 py-3 text-[#09081b] transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                Talk to Cerebro
              </OpenAssistantButton>
              <Link
                href="/pricing"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/35 bg-white/10 px-6 py-3 transition hover:-translate-y-0.5 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                See plans and pricing
              </Link>
            </div>
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
      <FloatingAssistantLazy />
    </div>
  );
}
