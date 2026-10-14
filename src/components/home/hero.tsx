import { Bot, Check, KeyRound, MapPin } from "lucide-react";
import { TerritoryClaim } from "@/components/territory-claim";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";

const PILLARS = [
  { icon: MapPin, title: "Exclusive ZIP demand", body: "One loan officer per territory." },
  { icon: Bot, title: "Autonomous intake", body: "Captures, scores, and books 24/7." },
  { icon: KeyRound, title: "Portable pipeline", body: "Leads and domains stay with you." },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <div className="ypn-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl"
        aria-hidden
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 pb-20 pt-14 sm:px-6 lg:flex-row lg:items-start lg:gap-14 lg:pt-20">
        <div className="flex max-w-xl flex-1 flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            For licensed mortgage loan officers
          </span>
          <h1
            id="hero-title"
            className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]"
          >
            Own your ZIP. Automate intake.{" "}
            <span className="bg-gradient-to-r from-violet-300 via-indigo-300 to-sky-300 bg-clip-text text-transparent">
              Keep every lead for life.
            </span>
          </h1>
          <p className="mt-6 text-pretty text-lg leading-relaxed text-slate-300">
            YPN USA gives you exclusive borrower demand in your ZIP codes and an AI intake agent that qualifies
            and books borrowers around the clock. Your leads, domain, and funnels belong to you, not your
            brokerage.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#pricing"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070816]"
            >
              Start 15-day free trial
            </a>
            <OpenAssistantButton className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-7 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
              Talk to the AI agent
            </OpenAssistantButton>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-slate-400">
            {["Free Cerebro plan, no card", "Cancel anytime", "100% lead ownership"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="ypn-glass rounded-2xl p-4">
                <Icon className="h-5 w-5 text-indigo-300" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-[13px] leading-snug text-slate-400">{body}</p>
              </li>
            ))}
          </ul>
        </div>

        <div id="zip-check" className="w-full scroll-mt-24 lg:max-w-[440px]">
          <TerritoryClaim source="hero" />
        </div>
      </div>
    </section>
  );
}
