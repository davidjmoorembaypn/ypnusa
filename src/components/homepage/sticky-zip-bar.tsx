"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ZipInput } from "@/components/zip-input";
import { checkoutUrlForTier, payNowUrlForTier } from "@/lib/checkout";
import { trackFunnel } from "@/lib/funnel-events";
import { track } from "@/lib/track";
import {
  fetchTerritoryCheck,
  isCompleteZip,
  publishZipStatus,
  syncZipToPageUrl,
  useZipStatus,
} from "@/lib/zip-session";

const SOURCE = "sticky_zip_bar";

/** Height the bar reserves at the bottom of the page; the Cerebro launcher sits above it. */
const BAR_OFFSET_VAR = "--ypn-sticky-zip-bar";

/**
 * Compact bar pinned to the bottom of the screen once the hero (and its ZIP code check) has
 * scrolled away. It replaces the second ZIP code form that used to sit mid-page:
 *  - a ZIP code already checked this session shows its status and one action;
 *  - otherwise it is a one-line ZIP code lookup, using the same check and the same checkout links.
 * Never opens by itself over content: it is a slim strip, and the page reserves room for it.
 */
export function StickyZipBar({ heroId = "hero" }: { heroId?: string }) {
  const status = useZipStatus();
  const inputId = useId();
  const [pastHero, setPastHero] = useState(false);
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero || typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      threshold: 0,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroId]);

  const shownTracked = useRef(false);
  useEffect(() => {
    if (!pastHero || shownTracked.current) return;
    shownTracked.current = true;
    track("home_sticky_zip_bar_shown", { state: status ? (status.available ? "open" : "locked") : "lookup" });
  }, [pastHero, status]);

  useEffect(() => {
    const root = document.documentElement;
    if (pastHero) root.style.setProperty(BAR_OFFSET_VAR, "4.5rem");
    else root.style.removeProperty(BAR_OFFSET_VAR);
    return () => {
      root.style.removeProperty(BAR_OFFSET_VAR);
    };
  }, [pastHero]);

  async function check() {
    if (busy) return;
    if (!isCompleteZip(zip)) {
      setError("Enter all 5 digits.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await fetchTerritoryCheck(zip);
      if (!data.valid) {
        setError(data.message || "That ZIP code isn't valid.");
        return;
      }
      // Same rule as the hero check: only an open ZIP code is ever passed on to the checkout links.
      syncZipToPageUrl(data.available ? data.zip : null);
      publishZipStatus({ zip: data.zip, available: data.available, city: data.city, state: data.state });
      track("zip_check", { zip: data.zip, available: data.available, source: SOURCE });
      setEditing(false);
      setZip("");
    } catch {
      setError("Couldn't check. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!pastHero) return null;

  const showStatus = status && !editing;
  const ready = isCompleteZip(zip);

  return (
    <aside
      aria-label="ZIP code availability"
      data-sticky-zip-bar=""
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-300 bg-white/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6"
    >
      <div className="mx-auto flex min-h-[52px] w-full max-w-4xl items-center gap-2 sm:gap-4">
        {showStatus ? (
          <>
            <p className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-slate-900 sm:text-sm" role="status">
              <span
                aria-hidden
                className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${status.available ? "bg-emerald-600" : "bg-amber-600"}`}
              />
              {status.available ? (
                <>
                  {status.zip} is OPEN <span className="font-normal text-slate-700">&mdash; Lock your territory now</span>
                </>
              ) : (
                <>
                  {status.zip} is LOCKED <span className="font-normal text-slate-700">&mdash; try a nearby ZIP code</span>
                </>
              )}
            </p>
            {status.available ? (
              <a
                href={payNowUrlForTier("growth", status.zip) ?? checkoutUrlForTier("growth", status.zip)}
                onClick={() => {
                  track("begin_checkout", { plan: "growth", zip: status.zip, source: SOURCE, checkout: "pay_now" });
                  trackFunnel("checkout_started", { plan: "growth", checkout: "pay_now", source: SOURCE });
                }}
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Lock ZIP<span className="hidden sm:inline">&nbsp;{status.zip}</span>
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                track("home_sticky_zip_bar_change", { zip: status.zip, available: status.available });
                setEditing(true);
                setError(null);
              }}
              className="inline-flex min-h-[44px] shrink-0 items-center rounded-full px-2 text-[13px] font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
            >
              {status.available ? "Change" : "Check another"}
            </button>
          </>
        ) : (
          <form
            className="flex w-full items-center gap-2 sm:gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void check();
            }}
          >
            <label htmlFor={inputId} className="hidden shrink-0 text-sm font-semibold text-slate-900 sm:block">
              Is your ZIP code open?
            </label>
            <ZipInput
              id={inputId}
              value={zip}
              onValueChange={(next) => {
                setZip(next);
                setError(null);
              }}
              invalid={Boolean(error)}
              describedBy={`${inputId}-msg`}
              ariaLabel="Your 5-digit ZIP code"
              placeholder="ZIP code"
              className="min-h-[44px] w-full min-w-0 flex-1 rounded-full border border-slate-400 bg-white px-4 text-base font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-500 sm:max-w-[11rem]"
            />
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className={`inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border-2 border-emerald-700 px-4 py-2 text-sm font-bold transition disabled:cursor-wait disabled:opacity-70 ${
                ready ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-white text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              {busy ? "Checking…" : "Check ZIP"}
            </button>
            <p id={`${inputId}-msg`} role="status" className="hidden min-w-0 flex-1 text-[13px] sm:block">
              {error ? (
                <span className="font-semibold text-rose-700">{error}</span>
              ) : ready ? (
                <span className="font-semibold text-emerald-800">Ready to check.</span>
              ) : (
                <span className="text-slate-700">Free and instant. One YPN USA loan officer per ZIP code.</span>
              )}
            </p>
            {error ? <span className="shrink-0 text-xs font-semibold text-rose-700 sm:hidden">{error}</span> : null}
            {status && editing ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="inline-flex min-h-[44px] shrink-0 items-center px-1 text-[13px] font-semibold text-slate-700 underline underline-offset-2"
              >
                Cancel
              </button>
            ) : null}
          </form>
        )}
      </div>
    </aside>
  );
}
