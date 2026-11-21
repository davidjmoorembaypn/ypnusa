"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { track } from "@/lib/track";
import { ZipInput } from "@/components/zip-input";
import { isCompleteZip } from "@/lib/zip-session";

/** 60-day estimate from /api/territory/check (Census-based, see src/lib/zip-demand.ts). */
interface Demand {
  window_days?: number;
  total?: number;
  buyers?: number;
  sellers?: number;
  movers_in?: number;
  basis?: "census_acs" | "none";
  methodology?: string;
}

interface CheckResponse {
  ok?: boolean;
  zip?: string;
  valid?: boolean;
  available?: boolean;
  message?: string;
  city?: string | null;
  state?: string | null;
  demand?: Demand | null;
  error?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "result"; data: CheckResponse };

export function ZipDemandCheck() {
  const inputId = useId();
  const [zip, setZip] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    track("check_zip_page_view");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = zip.trim();
    if (!/^\d{5}$/.test(clean)) {
      setState({ kind: "error", message: "Enter a valid 5-digit ZIP code." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const data = (await res.json()) as CheckResponse;
      if (!res.ok || data.error) {
        setState({ kind: "error", message: data.error ?? "We could not check that ZIP code. Please try again." });
        return;
      }
      track("check_zip_result", { available: Boolean(data.available) });
      setState({ kind: "result", data });
    } catch {
      setState({ kind: "error", message: "We could not check that ZIP code. Please try again." });
    }
  }

  return (
    <div className="rounded-[28px] border border-white/15 bg-white/[0.06] p-6 md:p-8">
      <form onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
          Your ZIP code (where you work)
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <ZipInput
            id={inputId}
            value={zip}
            onValueChange={(next) => {
              setZip(next);
              if (state.kind === "error") setState({ kind: "idle" });
            }}
            invalid={state.kind === "error"}
            placeholder="e.g. 93701"
            className="min-h-[52px] w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 placeholder:font-normal placeholder:text-slate-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={state.kind === "loading"}
            data-ready={isCompleteZip(zip) ? "true" : "false"}
            className={`min-h-[52px] shrink-0 rounded-2xl px-6 py-3 text-base font-bold text-[#09081b] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-60 ${
              isCompleteZip(zip) ? "bg-amber-400 shadow-lg shadow-amber-500/30" : "bg-amber-200"
            }`}
          >
            {state.kind === "loading" ? "Checking…" : "Show my 60-day estimate"}
          </button>
        </div>
        <p className="mt-2 text-[13px] text-white/80">
          {isCompleteZip(zip)
            ? "✓ 5 digits. Ready to check."
            : zip.length > 0
              ? `Enter ${5 - zip.length} more digit${5 - zip.length === 1 ? "" : "s"}.`
              : "Numbers only, 5 digits."}
        </p>
      </form>

      <div aria-live="polite" role="status" className="mt-5 min-h-[120px]">
        {state.kind === "idle" && (
          <p className="text-sm text-white/80">
            Enter a ZIP code to see an estimate of how many households buy, sell or move there in a typical 60 days.
          </p>
        )}
        {state.kind === "error" && <p className="text-sm font-medium text-rose-200">{state.message}</p>}
        {state.kind === "result" && <Result data={state.data} />}
      </div>
    </div>
  );
}

function Result({ data }: { data: CheckResponse }) {
  if (data.valid === false) return <p className="text-sm font-medium text-rose-200">{data.message}</p>;
  const place = data.city && data.state ? `${data.city}, ${data.state}` : `ZIP code ${data.zip}`;
  const d = data.demand;
  return (
    <div>
      <p className="text-lg font-semibold text-white">{place}</p>
      {d && d.basis === "census_acs" && typeof d.total === "number" ? (
        <>
          <p className="mt-1 text-white/85">
            About <strong className="text-white">{d.total}</strong> households buying, selling or moving in over a typical {d.window_days ?? 60} days.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ["Buyers", d.buyers],
              ["Sellers", d.sellers],
              ["Renters in", d.movers_in],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/15 bg-white/[0.05] px-2 py-3">
                <dt className="text-xs uppercase tracking-wide text-white/75">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{typeof value === "number" ? value : "n/a"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-5 text-white/70">
            {d.methodology ?? "Illustrative market estimate, not a lead count."} Based on households that moved in during the past year (U.S. Census
            Bureau American Community Survey), not a forecast.
          </p>
        </>
      ) : (
        <p className="mt-1 text-white/85">The Census has no residential data for this ZIP code, so there is no activity estimate.</p>
      )}
      <p className="mt-4 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-white">
        {data.available ? "Open: this ZIP code is still available. " : "Taken: "}
        {data.message}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {data.available ? (
          <Link
            href={`/claim-territory?zip=${data.zip}`}
            className="inline-flex min-h-[48px] items-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-[#09081b] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Claim my exclusive ZIP code
          </Link>
        ) : null}
        <Link
          href="/pricing"
          className="inline-flex min-h-[48px] items-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          See plans &amp; pricing
        </Link>
      </div>
    </div>
  );
}
