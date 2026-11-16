"use client";

import { useEffect, useState } from "react";

/**
 * Dashboard card that turns phone alerts on or off for this device. Alerts cover new leads,
 * new chats on the officer's page and borrower replies during a takeover. They never contain
 * borrower details. On iPhone, alerts only work once YPN USA is added to the home screen.
 */

type State =
  | "loading"
  | "unsupported"
  | "needs_install"
  | "blocked"
  | "off"
  | "on"
  | "working"
  | "error";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

async function workerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  return existing ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

export function PhoneAlertsCard() {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        setState(isIos() && !isStandalone() ? "needs_install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = registration ? await registration.pushManager.getSubscription() : null;
        setState(subscription && Notification.permission === "granted" ? "on" : "off");
      } catch {
        setState("off");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function turnOn() {
    setState("working");
    setMessage(null);
    try {
      const keyRes = await fetch("/api/push", { cache: "no-store" });
      const keyBody = (await keyRes.json()) as { ok?: boolean; publicKey?: string };
      if (!keyBody.ok || !keyBody.publicKey) throw new Error("no key");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await workerRegistration();
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(keyBody.publicKey),
        }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
      setMessage("Alerts are on for this device.");
    } catch {
      setState("error");
      setMessage("Couldn't turn on alerts. Try again in a moment.");
    }
  }

  async function turnOff() {
    setState("working");
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      setMessage("Alerts are off for this device.");
    } catch {
      setState("error");
      setMessage("Couldn't turn off alerts. Try again in a moment.");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <section
      aria-label="Phone alerts"
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900"
    >
      <p className="font-semibold">Phone alerts for new leads and chats</p>
      <p className="mt-1 text-slate-600">
        {state === "needs_install"
          ? "On iPhone, add YPN USA to your home screen first, then open it from there to turn on alerts."
          : state === "blocked"
            ? "Alerts are blocked for this site in your browser settings. Allow notifications there, then come back."
            : "Get a ping when a new lead comes in or a borrower chats on your page. Alerts never show borrower details."}
      </p>
      {state === "off" || state === "error" ? (
        <button
          type="button"
          onClick={() => void turnOn()}
          className="mt-3 min-h-11 rounded-full bg-violet-700 px-5 font-semibold text-white hover:bg-violet-600"
        >
          Turn on alerts
        </button>
      ) : null}
      {state === "on" ? (
        <button
          type="button"
          onClick={() => void turnOff()}
          className="mt-3 min-h-11 rounded-full border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Turn off alerts
        </button>
      ) : null}
      {state === "working" ? <p className="mt-3 text-slate-500">One moment...</p> : null}
      {message ? <p className="mt-2 text-slate-600">{message}</p> : null}
    </section>
  );
}
