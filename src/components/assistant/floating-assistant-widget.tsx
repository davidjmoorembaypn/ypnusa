"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OPEN_ASSISTANT_EVENT } from "./open-assistant-button";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { track } from "@/lib/track";

// The chat bundle is only needed once the full chat opens, so keep it out of the initial page JS.
const AssistantChat = dynamic(() => import("./assistant-chat").then((mod) => mod.AssistantChat), {
  ssr: false,
  loading: () => (
    <div role="status" className="min-h-[20rem] p-5 text-sm text-white/70">
      Loading Cerebro…
    </div>
  ),
});

const GREETING_DELAY_MS = 3500;
const DISMISSED_KEY = "ypn_assistant_widget_dismissed";

type View = "launcher" | "greeting" | "chat";

/**
 * Site-wide floating Cerebro for the public site. Shortly after landing it greets
 * the visitor with a compact, solid card and three one-tap next steps (check a ZIP,
 * see pricing, start free) plus "Ask Cerebro", which opens the full chat. The
 * greeting shows once per browser session; after it's closed only the launcher
 * button remains. The card is small enough not to cover the hero on desktop or
 * take over the screen on mobile.
 *
 * Deliberately mounted per-page (currently just the homepage) rather than
 * in the root layout: it should not follow a signed-in MLO into
 * /dashboard, /login, etc., where other assistant surfaces already exist.
 */
export function FloatingAssistantWidget() {
  const [view, setView] = useState<View>("launcher");
  const router = useRouter();

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      /** noop — private browsing / disabled storage just means it may greet each load */
    }
    if (dismissed) return;
    const timer = window.setTimeout(() => {
      setView((current) => (current === "launcher" ? "greeting" : current));
      track("assistant_greeting_shown", { source: "homepage_floating_widget" });
    }, GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
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
    const target = document.getElementById("territories");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => target.querySelector<HTMLInputElement>("input")?.focus(), 600);
    } else {
      router.push("/claim-territory");
    }
  }

  const closeButton = (
    <button
      type="button"
      onClick={close}
      aria-label="Close Cerebro"
      className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
        <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );

  return (
    // bottom-24 clears this app's mobile sticky conversion bar (see page.tsx) —
    // that bar is md:hidden, so bottom-6 is fine again at the md breakpoint.
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {view === "chat" ? (
        <div className="flex max-h-[calc(100dvh-8rem)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl bg-[#0d0b26] shadow-2xl shadow-black/50 ring-1 ring-white/15">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <p className="text-sm font-semibold text-white">Cerebro · YPN USA</p>
            {closeButton}
          </div>
          <div className="overflow-y-auto">
            <AssistantChat
              mode="public_site"
              funnelSource="homepage_floating_widget"
              title="Ask Cerebro"
              placeholder="Ask about your ZIP code, pricing, or how it works…"
            />
          </div>
        </div>
      ) : null}

      {view === "greeting" ? (
        <div
          role="dialog"
          aria-label="Cerebro"
          className="w-[calc(100vw-2rem)] max-w-[20rem] rounded-3xl bg-[#0d0b26] p-4 text-white shadow-2xl shadow-black/50 ring-1 ring-white/15"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">Cerebro</p>
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
              className="rounded-2xl bg-amber-400 px-4 py-2.5 text-left text-sm font-bold text-[#09081b] transition hover:brightness-105"
            >
              Check if my ZIP code is open →
            </button>
            <Link
              href="/pricing"
              onClick={() => track("assistant_next_step", { step: "pricing" })}
              className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15"
            >
              See plans &amp; pricing
            </Link>
            <a
              href={FREE_SIGNUP_HREF}
              onClick={() => track("assistant_next_step", { step: "start_free" })}
              className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/15"
            >
              Start free (no card)
            </a>
            <button
              type="button"
              onClick={() => {
                track("assistant_next_step", { step: "ask" });
                setView("chat");
              }}
              className="rounded-2xl px-4 py-2 text-left text-sm font-semibold text-violet-200 underline underline-offset-2 hover:text-white"
            >
              Ask Cerebro a question
            </button>
          </div>
        </div>
      ) : null}

      {view === "launcher" ? (
        <button
          type="button"
          onClick={() => setView("greeting")}
          className="group flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-2xl shadow-violet-950/40 transition hover:from-violet-400 hover:to-violet-600"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path
              d="M2.5 10a7.5 7.5 0 1 1 3.4 6.28L2.5 17.5l1.22-3.4A7.46 7.46 0 0 1 2.5 10Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          Ask Cerebro
        </button>
      ) : null}
    </div>
  );
}
