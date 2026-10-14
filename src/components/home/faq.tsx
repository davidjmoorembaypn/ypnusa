import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./section-heading";

export const FAQ_ITEMS = [
  {
    q: "How does ZIP exclusivity work?",
    a: "Each paid plan includes one exclusive ZIP. While your subscription is active, YPN USA routes borrower demand in that ZIP only to you. Free accounts can explore the platform but never reserve a territory.",
  },
  {
    q: "What happens during the 15-day free trial?",
    a: "Paid plans start with a 15-day free trial. Your ZIP is locked and the intake agent is live from day one. Cancel before the trial ends and you will not be charged.",
  },
  {
    q: "Which loan programs does the AI intake agent handle?",
    a: "FHA, VA, Conventional, DSCR, HELOC, Refinance, and Jumbo. The agent asks lane-specific questions, scores the borrower, and books qualified conversations directly onto your calendar.",
  },
  {
    q: "Do I really keep my leads if I change brokerages?",
    a: "Yes. Your lead database, website, domain, and funnels are tied to you as the loan officer. You can export everything at any time and take it with you.",
  },
  {
    q: "Is YPN USA a lender?",
    a: "No. YPN USA is a technology platform for licensed mortgage loan officers. It does not make loans, issue credit decisions, or provide rate quotes.",
  },
];

export function Faq() {
  return (
    <section aria-labelledby="faq-title" id="faq" className="scroll-mt-24 px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Questions loan officers ask first" />
        <div className="mt-12 flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="ypn-glass group rounded-2xl px-6 py-5 open:ring-1 open:ring-indigo-400/30">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-white [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title" className="px-4 pb-24 sm:px-6">
      <div className="ypn-glass ypn-glow relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-12">
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl"
          aria-hidden
        />
        <h2 id="final-cta-title" className="relative text-balance text-3xl font-semibold tracking-tight text-white lg:text-4xl">
          Your ZIP is either open or it&apos;s someone else&apos;s.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-pretty text-slate-300">
          Check availability in seconds, then lock it with a 15-day free trial.
        </p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="#zip-check"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            Check my ZIP
          </a>
          <a
            href="#pricing"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            Compare plans
          </a>
        </div>
      </div>
    </section>
  );
}
