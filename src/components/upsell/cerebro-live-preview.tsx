"use client";

import { useEffect, useState } from "react";
import { CEREBRO_ASK_EVENT } from "@/components/assistant/assistant-chat";
import { track } from "@/lib/track";
import type { UpgradeRequest } from "./territory-upgrade-modal";

/** An illustration of a borrower chat, labeled as one: no real borrower's words. */
const EXAMPLE: Array<{ who: "borrower" | "cerebro"; text: string }> = [
  { who: "borrower", text: "Hi! What would my monthly payment be on a $400k house here?" },
  {
    who: "cerebro",
    text: "Happy to help. Your payment depends on your down payment, rate, taxes and insurance, so your loan officer will run real numbers with you. Are you hoping to buy in the next 3 months, or later this year?",
  },
  { who: "borrower", text: "Probably this spring, we already have about 10% saved and…" },
];

const TRY_IT = [
  {
    title: "Realtor co-marketing pitch",
    body: "A short, compliant note to a local agent about working together.",
    prompt: "Write a short co-marketing pitch I can send to a local Realtor about working together. Keep it compliant: no rates and no promises.",
  },
  {
    title: "Rate-drop follow-up script",
    body: "A text and email for past clients when refinancing might make sense.",
    prompt: "Draft a follow-up text and email I can send past clients when rates drop and a refinance might help them. No rate numbers or promises.",
  },
  {
    title: "Borrower simulator",
    body: "Play a homebuyer and see how fast Cerebro qualifies you.",
    prompt: "Let's practice: act as my borrower-facing assistant on my website. I'll play a first-time homebuyer, you qualify me the way you would a real borrower. Start by greeting me.",
  },
] as const;

const AUTOPILOT = [
  { label: "Borrower follow-up email, 24/7", detail: "Cerebro answers and follows up with your borrowers day and night." },
  { label: "Instant calendar booking", detail: "Qualified borrowers book straight onto your calendar." },
  { label: "Website autopilot", detail: "Cerebro applies and keeps improving your page and local SEO." },
] as const;

function askCerebro(prompt: string, title: string) {
  track("cerebro_sandbox_try", { tool: title });
  document.getElementById("cerebro-chat")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.dispatchEvent(new CustomEvent(CEREBRO_ASK_EVENT, { detail: { prompt } }));
}

export function CerebroLivePreview(props: { freeMessages: number; freeActions: number; onUpgrade: (request: UpgradeRequest) => void }) {
  const { freeMessages, freeActions, onUpgrade } = props;
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (shown >= EXAMPLE.length) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const timer = window.setTimeout(() => setShown(reduce ? EXAMPLE.length : (n) => n + 1), reduce ? 0 : 1600);
    return () => window.clearTimeout(timer);
  }, [shown]);

  return (
    <section aria-label="Cerebro preview" className="mt-8 rounded-3xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">See Cerebro work for you</h2>
        <p className="text-xs text-slate-600">
          Free plan: {freeMessages} messages and {freeActions} finished Cerebro {freeActions === 1 ? "task" : "tasks"} a day
        </p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Example chat on a loan officer&rsquo;s page</p>
          <ol className="mt-3 space-y-2" aria-live="polite">
            {EXAMPLE.slice(0, shown).map((line, index) => {
              const last = index === EXAMPLE.length - 1;
              const bubble =
                line.who === "cerebro"
                  ? "ml-auto bg-violet-700 text-white"
                  : "mr-auto border border-slate-200 bg-white text-slate-800";
              return (
                <li key={index} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6 ${bubble}`}>
                  {last ? (
                    <span className="relative block">
                      <span aria-hidden="true" className="block blur-sm select-none">
                        {line.text}
                      </span>
                      <span className="sr-only">The borrower&rsquo;s reply is hidden on the Free plan.</span>
                    </span>
                  ) : (
                    line.text
                  )}
                </li>
              );
            })}
          </ol>
          {shown >= EXAMPLE.length ? (
            <button
              type="button"
              onClick={() => onUpgrade({ reason: "cerebro" })}
              className="mt-3 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Upgrade to read &amp; take over chats →
            </button>
          ) : null}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Try it now</p>
          <ul className="mt-3 space-y-2">
            {TRY_IT.map((tool) => (
              <li key={tool.title}>
                <button
                  type="button"
                  onClick={() => askCerebro(tool.prompt, tool.title)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-400 hover:bg-violet-50"
                >
                  <span className="block text-sm font-semibold text-slate-900">{tool.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-600">{tool.body}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Autopilot (paid plans)</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {AUTOPILOT.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                role="switch"
                aria-checked="false"
                aria-label={`${item.label}: part of paid plans`}
                onClick={() => {
                  track("autopilot_switch_locked_click", { feature: item.label });
                  onUpgrade({ reason: "autopilot" });
                }}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-400"
              >
                <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-200 p-0.5">
                  <span className="h-4 w-4 rounded-full bg-white shadow" />
                </span>
                <span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                    {item.label}
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-slate-400">
                      <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm-2 6V6a2 2 0 1 1 4 0v2H8Z" />
                    </svg>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">{item.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
