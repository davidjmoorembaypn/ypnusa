"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";

type Neighbor = { zip: string; city: string; state: string; miles: number };

type State =
  | { status: "loading" }
  | { status: "open" }
  | { status: "claimed"; neighbors: Neighbor[] }
  | { status: "unavailable" };

/** Claim page with the ZIP code prefilled and checked on arrival (see TerritoryClaim's ?zip= handling). */
export function claimHref(zip: string, medium: string): string {
  return `/claim-territory?zip=${encodeURIComponent(zip)}&utm_source=zip_page&utm_medium=${medium}&utm_campaign=zip_territory#claim`;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * B2B card for loan officers visiting a ZIP code page. It reads the live ledger on the client (the
 * page itself is static). If the ledger can't be reached it says nothing about availability, so a
 * ZIP code is never described as unclaimed on a guess.
 */
export function ZipTerritoryBanner({ zip, city, state }: { zip: string; city: string; state: string }) {
  const [view, setView] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const check = await getJson<{ ok?: boolean; available?: boolean; valid?: boolean }>(`/api/territory/check?zip=${encodeURIComponent(zip)}`);
      if (cancelled) return;
      if (!check || check.ok === false || check.valid === false || typeof check.available !== "boolean") {
        setView({ status: "unavailable" });
        return;
      }
      if (check.available) {
        setView({ status: "open" });
        track("zip_page_banner_view", { zip, status: "open" });
        return;
      }
      const near = await getJson<{ neighbors?: Neighbor[] }>(`/api/territory/neighbors?zip=${encodeURIComponent(zip)}`);
      if (cancelled) return;
      setView({ status: "claimed", neighbors: (near?.neighbors ?? []).slice(0, 3) });
      track("zip_page_banner_view", { zip, status: "claimed" });
    })();
    return () => {
      cancelled = true;
    };
  }, [zip]);

  const place = city && state ? `${city}, ${state} ${zip}` : `ZIP code ${zip}`;
  const cta =
    "inline-flex min-h-[44px] items-center justify-center rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-[#09081b] shadow transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200";

  return (
    <section aria-label="Loan officer territory status" className="border-b border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-6" aria-live="polite">
        {view.status === "loading" ? (
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70" aria-hidden />
        ) : view.status === "open" ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-amber-950">Licensed Loan Officer? ZIP Code {zip} is currently UNCLAIMED.</h2>
              <p className="mt-1 text-sm text-amber-950/80">
                Lock exclusive borrower routing before another MLO claims it. Exclusive mortgage leads for {place}: one loan officer per ZIP code on YPN USA.
              </p>
            </div>
            <a href={claimHref(zip, "banner")} onClick={() => track("zip_page_banner_click", { zip, status: "open" })} className={`${cta} shrink-0`}>
              Lock ZIP {zip} &rarr;
            </a>
          </div>
        ) : view.status === "claimed" ? (
          <div className="rounded-2xl border border-slate-300 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">Territory Active &mdash; Represented by a Licensed MLO</h2>
            {view.neighbors.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-slate-700">Loan officer? These nearby ZIP codes are still open:</p>
                <ul className="mt-3 flex flex-wrap gap-3">
                  {view.neighbors.map((n) => (
                    <li key={n.zip}>
                      <a
                        href={claimHref(n.zip, "banner_neighbor")}
                        onClick={() => track("zip_page_banner_click", { zip, status: "claimed", neighbor: n.zip })}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        {n.zip}
                        {n.city ? ` · ${n.city}` : ""} &mdash; Claim ZIP {n.zip}
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-slate-600">Nearest by distance between ZIP code centers, so some are a few miles away.</p>
              </>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            Licensed loan officer?{" "}
            <a href={claimHref(zip, "banner")} className="font-semibold text-violet-700 underline">
              Check whether ZIP code {zip} is open
            </a>
            . One loan officer per ZIP code on YPN USA.
          </p>
        )}
      </div>
    </section>
  );
}
