"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "done" };

export default function SignupPage() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [consent, setConsent] = useState(false);
  const [zip, setZip] = useState("");
  const [form, setForm] = useState({
    name: "",
    workEmail: "",
    company: "",
    phone: "",
  });

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("zip") ?? "";
    if (/^\d{5}$/.test(value)) setZip(value);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setStatus({ kind: "error", message: "Please confirm that YPN USA may contact you about your setup." });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const response = await fetch("/api/demo-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          zip,
          role: "Loan officer",
          monthlyLeadVolume: "Free signup",
          source: "nextjs_signup",
          message: "Free YPN USA account setup",
          consent,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        setStatus({ kind: "error", message: body.error ?? "We could not save your setup. Please try again." });
        return;
      }
      setStatus({ kind: "done" });
    } catch {
      setStatus({ kind: "error", message: "Network error. Please try again in a moment." });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main className="flex flex-1 items-center py-16">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <section>
            <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">
              Free setup
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
              Start building a mortgage pipeline you own.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              Create your free YPN USA setup, explore the AI borrower intake, and check territory demand. No credit card and no ZIP is locked until you choose a paid plan.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/80">
              <li>✓ Your own AI borrower intake experience</li>
              <li>✓ Cerebro growth diagnostic</li>
              <li>✓ Leads and website remain portable</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/[0.07] p-6 shadow-2xl shadow-black/30 sm:p-8">
            {status.kind === "done" ? (
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400 text-2xl text-[#09081b]">✓</div>
                <h2 className="mt-5 text-2xl font-semibold">Your request is saved.</h2>
                <p className="mt-3 text-white/70">Next, explore the intake experience or choose a paid plan when you are ready to reserve a ZIP.</p>
                <div className="mt-7 grid gap-3">
                  <Link href="/embed/intake" className="rounded-full bg-amber-400 px-6 py-3 font-semibold text-[#09081b]">Try the AI intake</Link>
                  <Link href={zip ? `/pricing?zip=${zip}` : "/pricing"} className="rounded-full border border-white/25 px-6 py-3 font-semibold">View plans</Link>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4">
                <h2 className="text-2xl font-semibold">Start free</h2>
                <p className="text-sm text-white/65">No card required. Takes about one minute.</p>
                <Field label="Full name" value={form.name} onChange={(name) => setForm({ ...form, name })} autoComplete="name" />
                <Field label="Work email" type="email" value={form.workEmail} onChange={(workEmail) => setForm({ ...form, workEmail })} autoComplete="email" />
                <Field label="Company or brokerage" value={form.company} onChange={(company) => setForm({ ...form, company })} autoComplete="organization" />
                <Field label="Mobile phone (optional)" type="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} autoComplete="tel" required={false} />
                <Field label="ZIP to explore (optional)" inputMode="numeric" value={zip} onChange={(value) => setZip(value.replace(/\D/g, "").slice(0, 5))} autoComplete="postal-code" required={false} />
                <label className="flex items-start gap-3 text-xs leading-5 text-white/60">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-amber-400" />
                  YPN USA may contact me by email and, if provided, phone or text about this request. Message and data rates may apply; reply STOP to opt out.
                </label>
                {status.kind === "error" ? <p className="text-sm text-rose-200">{status.message}</p> : null}
                <button disabled={status.kind === "saving"} className="rounded-full bg-amber-400 px-6 py-3.5 font-semibold text-[#09081b] disabled:opacity-60">
                  {status.kind === "saving" ? "Saving…" : "Start free"}
                </button>
                <p className="text-center text-xs text-white/50">Already registered? <Link href="/login" className="underline">Log in</Link></p>
              </form>
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric";
  required?: boolean;
}) {
  return (
    <label className="text-sm font-medium text-white/80">
      {label}
      <input
        required={required}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/15 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
      />
    </label>
  );
}
