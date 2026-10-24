"use client";

import Link from "next/link";
import { useId, useState } from "react";

interface Demand {
  window_days?: number;
  total?: number;
  sellers?: number;
  buyers?: number;
  movers_in?: number;
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = zip.trim();
    if (!/^\d{5}$/.test(clean)) {
      setState({ kind: "error", message: "Enter a valid 5-digit zip code." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(clean)}`, { cache: "no-store" });
      const data = (await res.json()) as CheckResponse;
      if (!res.ok || data.error) {
        setState({ kind: "error", message: data.error ?? "We could not check that zip code. Please try again." });
        return;
      }
      setState({ kind: "result", data });
    } catch {
      setState({ kind: "error", message: "We could not check that zip code. Please try again." });
    }
  }

  return (
    <div className="rounded-[28px] border border-white/15 bg-white/[0.06] p-6 md:p-8">
      <form onSubmit={submit} noValidate>
        <label htmlFor={inputId} className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">
          Your zip code (where you work)
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id={inputId}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            placeholder="e.g. 93701"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 placeholder:font-normal placeholder:text-slate-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={state.kind === "loading"}
            className="shrink-0 rounded-2xl bg-violet-600 px-6 py-3 text-base font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-60"
          >
            {state.kind === "loading" ? "Checking…" : "Check"}
          </button>
        </div>
      </form>

      <div aria-live="polite" role="status" className="mt-5 min-h-[120px]">
        {state.kind === "idle" && (
          <p className="text-sm text-white/80">
            Enter a zip code to see how many people are expected to buy, sell or move in over the next 60 days.
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
  const place = data.city && data.state ? `${data.city}, ${data.state}` : `Zip code ${data.zip}`;
  const d = data.demand;
  return (
    <div>
      <p className="text-lg font-semibold text-white">{place}</p>
      {typeof d?.total === "number" ? (
        <>
          <p className="mt-1 text-white/85">
            About <strong className="text-white">{d.total}</strong> people buying, selling or moving in over the
            next {d.window_days ?? 60} days.
          </p>
          <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ["Buyers", d.buyers],
              ["Sellers", d.sellers],
              ["Moving in", d.movers_in],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl border border-white/15 bg-white/[0.05] px-2 py-3">
                <dt className="text-xs uppercase tracking-wide text-white/75">{label}</dt>
                <dd className="mt-1 text-xl font-semibold text-white">{typeof value === "number" ? value : "n/a"}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-1 text-white/85">Demand figures are not available for this zip code yet.</p>
      )}
      <p className="mt-4 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm text-white">
        {data.available ? "Open: this zip code is still available. " : "Taken: "}
        {data.message}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {data.available ? (
          <Link
            href={`/claim-territory?zip=${data.zip}`}
            className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-[#09081b] hover:brightness-105"
          >
            Claim this zip code
          </Link>
        ) : null}
        <Link
          href="/pricing"
          className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
        >
          See plans &amp; pricing
        </Link>
      </div>
    </div>
  );
}
