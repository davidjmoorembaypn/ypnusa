"use client";

import { useState } from "react";
import {
  RATE_SHEET_LINKS_CHECKED_ON,
  RATE_SHEET_LOAN_TYPES,
  sourcesForLoanType,
  type RateSheetLoanType,
} from "@/content/rate-sheet-directory";

type Filter = RateSheetLoanType | "All";
const FILTERS: readonly Filter[] = ["All", ...RATE_SHEET_LOAN_TYPES];

const KIND_STYLE: Record<string, string> = {
  "Public benchmark": "bg-sky-100 text-sky-900",
  "Agency guide": "bg-emerald-100 text-emerald-900",
  "Your lender": "bg-amber-100 text-amber-900",
};

export function RateSheetDirectory() {
  const [filter, setFilter] = useState<Filter>("All");
  const sources = sourcesForLoanType(filter);

  return (
    <div>
      <div role="group" aria-label="Filter by loan type" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              filter === f ? "border-[#13254a] bg-[#13254a] text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-600" aria-live="polite">
        Showing {sources.length} {sources.length === 1 ? "source" : "sources"} for {filter === "All" ? "every loan type" : filter}. Links last
        checked {RATE_SHEET_LINKS_CHECKED_ON}.
      </p>

      <ul className="mt-6 grid gap-4 md:grid-cols-2">
        {sources.map((s) => (
          <li key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${KIND_STYLE[s.kind]}`}>{s.kind}</span>
              {s.loanTypes.map((t) => (
                <span key={t} className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {t}
                </span>
              ))}
            </div>
            {/* h2, not h3: this is the first heading level under the page's h1 — no h2
                precedes it on the page, so h3 here would skip a level. */}
            <h2 className="mt-3 text-lg font-semibold text-[#13254a]">{s.name}</h2>
            <p className="text-sm font-medium text-slate-600">{s.publisher}</p>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">{s.whatItShows}</p>
            <p className="mt-3 text-xs text-slate-600">
              <span className="font-semibold">Source updates:</span> {s.updates}
            </p>
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-violet-700 underline underline-offset-4 hover:text-violet-900"
              >
                Open source<span className="sr-only"> (opens in a new tab)</span> &rarr;
              </a>
            ) : (
              <p className="mt-3 text-sm font-semibold text-slate-700">Ask your lender&rsquo;s account executive for this sheet.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
