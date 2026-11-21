"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OPEN_ASSISTANT_EVENT } from "./open-assistant-button";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { track } from "@/lib/track";
import { ZIP_STATUS_EVENT, ZIP_STATUS_STORAGE_KEY } from "@/lib/zip-session";

// The chat bundle is only needed once the full chat opens, so keep it out of the initial page JS.
const AssistantChat = dynamic(() => import("./assistant-chat").then((mod) => mod.AssistantChat), {
  ssr: false,
  loading: () => (
    <div role="status" className="min-h-[20rem] p-5 text-sm text-slate-700">
      Loading Cerebro…
    </div>
  ),
});

/** The greeting may open by itself only after this long on the page, or this far down it. */
const AUTO_OPEN_DELAY_MS = 12_000;
const AUTO_OPEN_SCROLL_DEPTH = 0.4;
const DISMISSED_KEY = "ypn_assistant_widget_dismissed";

type View = "launcher" | "greeting" | "chat";

/** True when the greeting card, opened now, would sit on top of a ZIP code field that is on screen. */
function greetingWouldCoverZipInput(): boolean {
  const width = Math.min(320, window.innerWidth - 32);
  const card = {
    left: window.innerWidth - 24 - width,
    right: window.innerWidth,
    top: window.innerHeight - 24 - 360,
    bottom: window.innerHeight,
  };
  for (const input of document.querySelectorAll<HTMLElement>("[data-zip-input]")) {
    const rect = input.getBoundingClientRect();
    // The sticky ZIP bar is pinned under the card by design (the widget sits above it).
    if (rect.width === 0 || rect.height === 0 || input.closest("[data-sticky-zip-bar]")) continue;
    const apart = rect.right < card.left || rect.left > card.right || rect.bottom < card.top || rect.top > card.bottom;
    if (!apart) return true;
  }
  return false;
}

/**
 * Site-wide floating Cerebro for the public site. It loads as a small launcher pill in the
 * bottom-right corner and stays that way, so it never sits over the hero's ZIP code check.
 * It opens its greeting card (three one-tap next steps plus "Ask Cerebro") by itself at most
 * once per browser session, and only when all of these hold:
 *  - the visitor has been on the page 12 seconds, or has scrolled 40% of the way down;
 *  - they have not focused, typed in or used a ZIP code field (they are already converting);
 *  - the card would not cover a ZIP code field that is on screen.
 * A click on the pill, or on any "Ask Cerebro" button, opens it at once.
 *
 * Deliberately mounted per-page rather than in the root layout: it should not follow a
 * signed-in MLO into /dashboard, /login, etc., where other assistant surfaces already exist.
 */
export function FloatingAssistantWidget({ startInChat = false }: { startInChat?: boolean } = {}) {
  const [view, setView] = useState<View>(startInChat ? "chat" : "launcher");
  const router = useRouter();
  const launcherRef = useRef<HTMLButtonElement>(null);
  // True while the launcher pill would sit on the hero's ZIP code card (its field, result or
  // checkout buttons). The pill steps aside then, so it can never cover that card on any screen.
  const [overZipCard, setOverZipCard] = useState(false);

  useEffect(() => {
    const card = document.getElementById("claim");
    if (!card) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const pill = launcherRef.current?.getBoundingClientRect();
      if (!pill) return;
      const area = card.getBoundingClientRect();
      // Inset by the card's own padding: brushing its empty edge is not covering it.
      const inset = 16;
      const apart =
        pill.right < area.left + inset || pill.left > area.right - inset || pill.bottom < area.top + inset || pill.top > area.bottom - inset;
      setOverZipCard(!apart);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(card);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [view]);

  useEffect(() => {
    let dismissed = false;
    let usedZip = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
      usedZip = window.sessionStorage.getItem(ZIP_STATUS_STORAGE_KEY) !== null;
    } catch {
      /** noop: private browsing / disabled storage just means it may greet each load */
    }
    if (dismissed) return;

    let zipInteraction = usedZip;
    let delayElapsed = false;
    let opened = false;

    const onZipInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-zip-input]")) zipInteraction = true;
    };
    const onZipChecked = () => {
      zipInteraction = true;
    };
    const scrollDepth = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      return scrollable > 0 ? window.scrollY / scrollable : 0;
    };
    const tryOpen = () => {
      if (opened || zipInteraction) return;
      if (!delayElapsed && scrollDepth() < AUTO_OPEN_SCROLL_DEPTH) return;
      if (greetingWouldCoverZipInput()) return; // tried again on the next scroll
      opened = true;
      setView((current) => (current === "launcher" ? "greeting" : current));
      track("assistant_greeting_shown", { source: "homepage_floating_widget" });
    };

    const timer = window.setTimeout(() => {
      delayElapsed = true;
      tryOpen();
    }, AUTO_OPEN_DELAY_MS);
    document.addEventListener("focusin", onZipInteraction);
    document.addEventListener("input", onZipInteraction);
    window.addEventListener(ZIP_STATUS_EVENT, onZipChecked);
    window.addEventListener("scroll", tryOpen, { passive: true });
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("focusin", onZipInteraction);
      document.removeEventListener("input", onZipInteraction);
      window.removeEventListener(ZIP_STATUS_EVENT, onZipChecked);
      window.removeEventListener("scroll", tryOpen);
    };
  }, []);

  useEffect(() => {
    const openFromCta = () => setView("chat");
    window.addEventListener(OPEN_ASSISTANT_EVENT, openFromCta);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, openFromCta);
  }, []);

  function close() {
    setView("launcher");
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /** noop */
    }
  }

  function checkZip() {
    track("assistant_next_step", { step: "check_zip" });
    close();
    const target = document.getElementById("claim") ?? document.getElementById("territories");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => target.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 600);
    } else {
      router.push("/claim-territory");
    }
  }

  const closeButton = (
    <button
      type="button"
      onClick={close}
      aria-label="Close Cerebro"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );

  return (
    // Sits above the sticky ZIP bar when that bar is showing (it publishes its height as a CSS variable).
    <div className="fixed bottom-[calc(var(--ypn-sticky-zip-bar,0px)+1rem)] right-4 z-40 flex flex-col items-end gap-3 md:bottom-[calc(var(--ypn-sticky-zip-bar,0px)+1.5rem)] md:right-6">
      {view === "chat" ? (
        <div className="flex max-h-[calc(100dvh-8rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl shadow-slate-900/20">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">Cerebro · YPN USA</p>
            {closeButton}
          </div>
          <div className="overflow-y-auto">
            <AssistantChat
              mode="public_site"
              funnelSource="homepage_floating_widget"
              title="Ask Cerebro"
              placeholder="Ask about your ZIP code, pricing, or how it works…"
              tone="light"
            />
          </div>
        </div>
      ) : null}

      {view === "greeting" ? (
        <div
          role="dialog"
          aria-label="Cerebro"
          className="ypn-rise-in w-[calc(100vw-2rem)] max-w-[20rem] rounded-3xl border border-slate-300 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/20"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-800">Cerebro</p>
              <p className="mt-1 text-[15px] font-semibold leading-snug">
                Hi! I help loan officers get exclusive local leads. What do you want to do?
              </p>
            </div>
            {closeButton}
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={checkZip}
              className="rounded-2xl bg-emerald-700 px-4 py-2.5 text-left text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Check if my ZIP code is open →
            </button>
            <Link
              href="/pricing"
              onClick={() => track("assistant_next_step", { step: "pricing" })}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              See plans &amp; pricing
            </Link>
            <a
              href={FREE_SIGNUP_HREF}
              onClick={() => track("assistant_next_step", { step: "start_free" })}
              className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Start free (no card)
            </a>
            <button
              type="button"
              onClick={() => {
                track("assistant_next_step", { step: "ask" });
                setView("chat");
              }}
              className="rounded-2xl px-4 py-2 text-left text-sm font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
            >
              Ask Cerebro a question
            </button>
          </div>
        </div>
      ) : null}

      {view === "launcher" ? (
        <button
          type="button"
          ref={launcherRef}
          onClick={() => setView("greeting")}
          aria-haspopup="dialog"
          aria-hidden={overZipCard || undefined}
          tabIndex={overZipCard ? -1 : undefined}
          className={`flex min-h-[44px] items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/15 transition hover:bg-slate-50 ${
            overZipCard ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-white">
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
              <path
                d="M2.5 10a7.5 7.5 0 1 1 3.4 6.28L2.5 17.5l1.22-3.4A7.46 7.46 0 0 1 2.5 10Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          Ask Cerebro
        </button>
      ) : null}
    </div>
  );
}
