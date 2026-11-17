"use client";

import { useCallback, useEffect, useState } from "react";
import { track } from "@/lib/track";
import type { LeadFeedCard, LeadFeedResult } from "@/lib/lead-feed";
import type { UpgradeRequest } from "./territory-upgrade-modal";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; feed: LeadFeedResult | null };

function ago(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function LeadCard({ card, zip, locked, onUnlock }: { card: LeadFeedCard; zip: string; locked: boolean; onUnlock: () => void }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{card.loanType}</p>
        <p className="text-xs text-slate-500">Received {ago(card.receivedAt)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Fact label="Loan amount" value={card.loanAmount} />
        <Fact label="Credit" value={card.creditBand} />
        <Fact label="Timeframe" value={card.timeframe} />
      </dl>
      {locked ? (
        <div className="relative mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3">
          {/* Placeholder shapes only: the server sent no name, phone or email for this request. */}
          <div aria-hidden="true" className="space-y-2 blur-sm select-none">
            <div className="h-3 w-40 rounded bg-slate-300" />
            <div className="h-3 w-28 rounded bg-slate-300" />
            <div className="h-3 w-48 rounded bg-slate-300" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-md">
            <button
              type="button"
              onClick={onUnlock}
              className="rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-800"
            >
              Unlock lead &amp; claim ZIP {zip} exclusively →
            </button>
          </div>
        </div>
      ) : card.contact ? (
        <dl className="mt-4 grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:grid-cols-3">
          <Fact label="Name" value={card.contact.name || "Not given"} />
          <Fact label="Phone" value={card.contact.phone || "Not given"} />
          <Fact label="Email" value={card.contact.email || "Not given"} />
        </dl>
      ) : null}
    </li>
  );
}

const LOAD_FAILED = "The feed didn't load. Try again in a moment.";

async function fetchFeed(target: string | null): Promise<{ state: State; zip?: string }> {
  try {
    const query = target ? `?zip=${encodeURIComponent(target)}` : "";
    const res = await fetch(`/api/leads/zip-feed${query}`, { cache: "no-store" });
    const data = (await res.json()) as { ok: boolean; feed?: LeadFeedResult | null; error?: string };
    if (!res.ok || !data.ok) return { state: { kind: "error", message: data.error || LOAD_FAILED } };
    return { state: { kind: "ready", feed: data.feed ?? null }, zip: data.feed?.zip };
  } catch {
    return { state: { kind: "error", message: LOAD_FAILED } };
  }
}

/**
 * Real borrower requests in a ZIP code. For a ZIP code the viewer doesn't hold, the server
 * already removed every contact detail (src/lib/lead-feed.ts); the blur only marks where they go.
 */
export function BlurredLeadFeed(props: { onUpgrade: (request: UpgradeRequest) => void }) {
  const { onUpgrade } = props;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [zipInput, setZipInput] = useState("");
  const [zip, setZip] = useState<string | null>(null);

  const apply = useCallback((result: { state: State; zip?: string }) => {
    setState(result.state);
    if (result.zip) setZip(result.zip);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchFeed(null).then((result) => {
      if (alive) apply(result);
    });
    return () => {
      alive = false;
    };
  }, [apply]);

  // Coming back from Stripe checkout: reload so a ZIP code that just locked shows its leads in full.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void fetchFeed(zip).then(apply);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [apply, zip]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = zipInput.replace(/\D/g, "").slice(0, 5);
    if (clean.length !== 5) {
      setState({ kind: "error", message: "Enter a 5-digit ZIP code." });
      return;
    }
    setState({ kind: "loading" });
    track("lead_feed_zip_search");
    void fetchFeed(clean).then(apply);
  }

  const feed = state.kind === "ready" ? state.feed : null;

  return (
    <section aria-label="ZIP code lead feed" className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Borrowers in your ZIP code</h2>
          <p className="mt-1 text-sm text-slate-600">Real requests from ypnus.com in the last 14 days.</p>
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor="lead-feed-zip" className="sr-only">
            ZIP code
          </label>
          <input
            id="lead-feed-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={zipInput}
            onChange={(event) => setZipInput(event.target.value)}
            placeholder={zip ?? "ZIP code"}
            className="w-28 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button type="submit" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">
            Show
          </button>
        </form>
      </div>

      {state.kind === "loading" ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : null}
      {state.kind === "error" ? (
        <p role="alert" className="mt-6 text-sm text-amber-800">
          {state.message}
        </p>
      ) : null}

      {state.kind === "ready" && !feed ? (
        <p className="mt-6 text-sm text-slate-600">Enter the ZIP code you want to own to see its borrower requests.</p>
      ) : null}

      {feed?.status === "taken" ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          ZIP code {feed.zip} belongs to another loan officer. Try a nearby ZIP code.
        </p>
      ) : null}

      {feed?.status === "open" ? (
        <>
          <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-950">
              ZIP code {feed.zip} is unclaimed.
              {feed.requestsLast7Days > 0
                ? ` ${feed.requestsLast7Days} borrower ${feed.requestsLast7Days === 1 ? "request" : "requests"} came in from it this week.`
                : ""}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              The first loan officer to pay for it gets every new request from it, plus the recent ones below.
            </p>
            <button
              type="button"
              onClick={() => onUpgrade({ zip: feed.zip, reason: "zip" })}
              className="mt-3 rounded-full bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800"
            >
              Claim ZIP {feed.zip} exclusively →
            </button>
          </div>
          {feed.cards.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {feed.cards.map((card) => (
                <LeadCard key={card.id} card={card} zip={feed.zip} locked onUnlock={() => onUpgrade({ zip: feed.zip, reason: "lead" })} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              No open requests in {feed.zip} right now. Claim it and new ones come straight to you.
            </p>
          )}
        </>
      ) : null}

      {feed?.status === "yours" ? (
        <>
          <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            ZIP code {feed.zip} is yours.
            {feed.movedToYou > 0
              ? ` ${feed.movedToYou} recent ${feed.movedToYou === 1 ? "request was" : "requests were"} just added to your pipeline.`
              : ""}
          </p>
          {feed.cards.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {feed.cards.map((card) => (
                <LeadCard key={card.id} card={card} zip={feed.zip} locked={false} onUnlock={() => undefined} />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">No requests in the last 14 days yet. New ones show here and in your alerts.</p>
          )}
        </>
      ) : null}
    </section>
  );
}
