"use client";

import { useState } from "react";
import { postJson } from "@/lib/client-api";

export function EmailLoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setState("sending");
    const { response, data } = await postJson<{ error?: string; devLink?: string }>("/api/auth/email-link", { email, next });
    if (!response.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setDevLink(data?.devLink ?? null);
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        <p className="font-semibold">Check your email.</p>
        <p className="mt-1">We sent a sign-in link to {email}. It works once and expires in 15 minutes.</p>
        {devLink && (
          <p className="mt-3 break-all text-xs">
            Dev only: <a href={devLink} className="underline">{devLink}</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-3">
      <label htmlFor="login-email" className="block text-sm font-semibold text-slate-800">
        Work email
      </label>
      <input
        id="login-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-[#13254a] focus:outline-none focus:ring-2 focus:ring-[#13254a]/20"
        placeholder="you@yourcompany.com"
      />
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-full bg-[#13254a] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c3566] disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      <p className="text-xs text-slate-500">New here? The same link creates your free account. No password needed.</p>
    </form>
  );
}
