"use client";

import { useEffect, useState } from "react";
import { AssistantChat } from "./assistant-chat";

const AUTO_OPEN_DELAY_MS = 6000;
const DISMISSED_KEY = "ypn_assistant_widget_dismissed";

/**
 * Site-wide floating launcher for the public_site AI assistant — the piece
 * that makes it actually "talk to people when they land on the page"
 * instead of living on a hidden /assistant preview route nobody sees. Opens
 * itself once per browser session shortly after landing (a proactive
 * greeting, not a popup ambush — it never reopens after being dismissed in
 * the same session) and otherwise sits as a small launcher button.
 *
 * Deliberately mounted per-page (currently just the homepage) rather than
 * in the root layout: it should not follow a signed-in MLO into
 * /dashboard, /login, etc., where other assistant surfaces already exist
 * (the autopilot panel, the mlo_dashboard-mode chat).
 */
export function FloatingAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      /** noop — private browsing / disabled storage just means it may reopen each load */
    }
    if (dismissed) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      setHasAutoOpened(true);
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  function close() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /** noop */
    }
  }

  return (
    // bottom-24 clears this app's mobile sticky conversion bar (see page.tsx) —
    // that bar is md:hidden, so z-40/bottom-6 is fine again at the md breakpoint.
    <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open ? (
        <div className="w-[calc(100vw-2.5rem)] max-w-sm">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={close}
              aria-label="Close assistant"
              className="rounded-full border border-white/15 bg-black/40 p-1.5 text-white/70 backdrop-blur transition hover:bg-black/60 hover:text-white"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <AssistantChat
            mode="public_site"
            funnelSource="homepage_floating_widget"
            title="YPN USA Assistant"
            placeholder="Ask about your ZIP, pricing, or how it works…"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
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
          {hasAutoOpened ? "Chat with us" : "Questions? Chat with us"}
        </button>
      )}
    </div>
  );
}
