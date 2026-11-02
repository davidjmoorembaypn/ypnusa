"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export function EmailLoginForm({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const response = await fetch("/api/auth/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), next }) });
      const result = await response.json();
      setMessage(response.ok ? result.message : result.error || "Please try again.");
    } catch { setMessage("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-6 space-y-4">
    <label className="block text-sm font-medium" htmlFor="login-email">Email address</label>
    <input id="login-email" name="email" type="email" autoComplete="email" required maxLength={254} className="w-full rounded-lg border border-slate-300 px-4 py-3" />
    <button disabled={busy} className="w-full rounded-full bg-violet-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Sending…" : "Email my sign-in link"}</button>
    <p className="text-sm text-slate-600">New here? Your free account is created when you verify your email. No card required.</p>
    <p role="status" className="text-sm text-slate-700">{message}</p>
  </form>;
}

export function VerifyEmailLogin() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function verify() {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (!token) { setMessage("This link is missing its token. Request a new sign-in link."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const result = await response.json();
      if (response.ok) {
        window.history.replaceState(null, "", window.location.pathname);
        window.location.assign(result.next);
      } else setMessage(result.error || "Please request a new link.");
    } catch { setMessage("Unable to connect. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 space-y-4">
    <button onClick={verify} disabled={busy} className="w-full rounded-full bg-violet-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Signing in…" : "Continue to my account"}</button>
    <p role="status" className="text-sm text-slate-700">{message}</p>
    <Link className="text-sm underline" href="/login">Request a new link</Link>
  </div>;
}
