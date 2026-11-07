"use client";

import Link from "next/link";
import { CEREBRO_ASK_EVENT } from "@/components/assistant/assistant-chat";
import { track } from "@/lib/track";
import type { VisibilityScore } from "@/lib/visibility-score";

/** Local Visibility Score: a progress meter plus a checklist with one-tap "Do it with Cerebro". */
export function VisibilityScoreCard({ score, chatAnchorId }: { score: VisibilityScore; chatAnchorId: string }) {
  function askCerebro(stepId: string, prompt: string) {
    track("visibility_step_cerebro", { step: stepId });
    document.getElementById(chatAnchorId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.dispatchEvent(new CustomEvent(CEREBRO_ASK_EVENT, { detail: { prompt } }));
  }

  return (
    <section aria-labelledby="visibility-score-title" className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="visibility-score-title" className="text-lg font-semibold">
            Local Visibility Score
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {score.doneCount} of {score.totalCount} setup steps done. Goal: 100%.
          </p>
        </div>
        <p className="text-4xl font-bold tracking-tight text-violet-700">{score.percent}%</p>
      </div>
      <div
        className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score.percent}
        aria-label="Local Visibility Score"
      >
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500" style={{ width: `${score.percent}%` }} />
      </div>
      <ul className="mt-5 divide-y divide-slate-100">
        {score.steps.map((step) => (
          <li key={step.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"
                }`}
              >
                ✓
              </span>
              <span className={step.done ? "text-slate-500 line-through" : step.comingSoon ? "text-slate-400" : "text-slate-800"}>
                {step.label}
                <span className="sr-only">{step.done ? " (done)" : step.comingSoon ? " (coming soon)" : " (to do)"}</span>
              </span>
            </span>
            {step.done ? null : step.comingSoon ? (
              <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 sm:self-auto">
                Coming soon
              </span>
            ) : step.cerebroPrompt ? (
              <button
                type="button"
                onClick={() => askCerebro(step.id, step.cerebroPrompt!)}
                className="self-start rounded-full bg-violet-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-violet-800 sm:self-auto"
              >
                Do it with Cerebro
              </button>
            ) : step.href ? (
              <Link
                href={step.href}
                className="self-start rounded-full border border-violet-300 px-4 py-2 text-xs font-semibold text-violet-800 transition hover:bg-violet-50 sm:self-auto"
              >
                {step.hrefLabel ?? "Open"}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
