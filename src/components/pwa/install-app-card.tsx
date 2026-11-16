"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * Registers the service worker (public/sw.js) and, when the phone supports it, shows an
 * inline "Install the app" card on the dashboard. Never a pop-up: it sits in the page and
 * disappears once the app is installed or the officer dismisses it.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "ypn-install-card-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const otherBrowser = /CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && !otherBrowser;
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

export function InstallAppCard() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  // Read on the client only; the server render (and first hydration pass) shows nothing.
  const eligible = useSyncExternalStore(
    noopSubscribe,
    () => !isStandalone() && !readDismissed(),
    () => false,
  );
  const showIosHint = useSyncExternalStore(noopSubscribe, isIosSafari, () => false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Not fatal: the dashboard works the same without the worker.
      });
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setClosed(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!eligible || closed || (!installEvent && !showIosHint)) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode: the card just comes back next visit.
    }
    setClosed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setClosed(true);
    setInstallEvent(null);
  };

  return (
    <section
      aria-label="Install the YPN USA app"
      className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-900"
    >
      <p className="font-semibold">Get new leads on your phone&apos;s home screen</p>
      {installEvent ? (
        <p className="mt-1 text-slate-600">Install YPN USA as an app. It opens straight to this dashboard.</p>
      ) : (
        <p className="mt-1 text-slate-600">
          In Safari, tap the Share button, then <strong>Add to Home Screen</strong>.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {installEvent ? (
          <button
            type="button"
            onClick={install}
            className="min-h-11 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-600"
          >
            Install the app
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="min-h-11 rounded-full border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
