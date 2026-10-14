"use client";

import { useId, useRef, useState } from "react";
import { postJson } from "@/lib/client-api";
import { marketingUrl } from "@/lib/site";
import { checkoutUrlForTier } from "@/lib/checkout";
import { usePersonalization } from "@/lib/hooks/usePersonalization";
import { useCTAEngine } from "@/lib/hooks/useCTAEngine";

type CheckState =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "result";
      zip: string;
      available: boolean;
      totalClaimed: number;
      message: string;
      city?: string | null;
      state?: string | null;
      signupUrl?: string | null;
      demandTotal?: number | null;
      source?: string | null;
    }
  | { status: "error"; message: string };

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

const VOLUME_OPTIONS = [
  "Just me (solo LO)",
  "2–5 loan officers",
  "6–20 loan officers",
  "Whole brokerage / branch",
];

const MARKETING_SIGNUP = marketingUrl("/lo-signup.html");

function signupHrefFor(zip?: string, plan = "free") {
  const params = new URLSearchParams({ plan });
  if (zip) params.set("zip", zip);
  return `${MARKETING_SIGNUP}?${params.toString()}`;
}

/** Fired on `window` whenever a ZIP check resolves, so PricingCta can react live. */
export const ZIP_CHECKED_EVENT = "ypnus:zip-checked";

/**
 * sessionStorage key PricingCta falls back to when it mounts on a different
 * route (e.g. /pricing) than the one TerritoryClaim ran on, so a ZIP checked
 * on the home page still locks the territory a visitor pays for after
 * clicking "Pricing" in the nav — a plain `?zip=` on the current page's URL
 * doesn't survive that navigation.
 */
export const ZIP_STORAGE_KEY = "ypnus:checked-zip";

/**
 * Reflects a confirmed ZIP into this page's own URL (no navigation/reload) so a
 * page reload or shared link carries it, broadcasts a same-page event so
 * components mounted before this check — the pricing tier CTAs — can pick it up
 * immediately rather than only on their own next mount, and persists it to
 * sessionStorage so it also survives navigating to a different route (e.g.
 * /pricing). See PricingCta.
 */
function syncZipToPageUrl(zip: string | null) {
  try {
    const url = new URL(window.location.href);
    if (zip) url.searchParams.set("zip", zip);
    else url.searchParams.delete("zip");
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new CustomEvent(ZIP_CHECKED_EVENT, { detail: { zip } }));
  } catch {
    /** noop — purely a cross-component convenience, never blocks the check flow. */
  }
  try {
    if (zip) sessionStorage.setItem(ZIP_STORAGE_KEY, zip);
    else sessionStorage.removeItem(ZIP_STORAGE_KEY);
  } catch {
    /** noop — sessionStorage can be unavailable (private browsing); not critical. */
  }
}

export function TerritoryClaim({ source = "territory_section" }: { source?: string }) {
  const zipInputId = useId();
  const [zip, setZip] = useState("");
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [consent, setConsent] = useState(false);
  const requestIdRef = useRef(0);
  const pendingZipRef = useRef<string | null>(null);
  const personalization = usePersonalization();
  const cta = useCTAEngine();

  const [form, setForm] = useState({
    name: "",
    workEmail: "",
    company: "",
    phone: "",
    role: "Loan officer",
    monthlyLeadVolume: VOLUME_OPTIONS[0],
    message: "",
  });

  async function runCheck(value: string = zip) {
    const clean = value.replace(/\D/g, "").slice(0, 5);
    if (check.status === "checking" && clean === pendingZipRef.current) return;
    syncZipToPageUrl(null);
    setZip(clean);
    if (clean.length !== 5) {
      setCheck({ status: "error", message: "Enter a valid 5-digit ZIP code." });
      return;
    }
    const requestId = ++requestIdRef.current;
    pendingZipRef.current = clean;
    setCheck({ status: "checking" });
    setSubmit({ status: "idle" });
    try {
      const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(clean)}`, {
        signal: AbortSignal.timeout(15_000),
      });
      // A newer ZIP was entered while this request was in flight; drop the stale result.
      if (requestId !== requestIdRef.current) return;
      if (!res.ok) {
        setCheck({ status: "error", message: "Couldn't check that territory — try again." });
        return;
      }
      const data = (await res.json()) as {
        zip: string;
        valid: boolean;
        available: boolean;
        totalClaimed: number;
        message: string;
        city?: string | null;
        state?: string | null;
        signupUrl?: string | null;
        demand?: { total?: number } | null;
        source?: string | null;
      };
      if (requestId !== requestIdRef.current) return;
      if (!data.valid) {
        setCheck({ status: "error", message: data.message });
        return;
      }
      setCheck({
        status: "result",
        zip: data.zip,
        available: data.available,
        totalClaimed: data.totalClaimed,
        message: data.message,
        city: data.city,
        state: data.state,
        signupUrl: data.signupUrl,
        demandTotal: data.demand?.total ?? null,
        source: data.source,
      });
      // Never propagate an unavailable ZIP into the pricing CTAs — a visitor could
      // otherwise pay for a territory the page just described as already claimed.
      if (data.available) syncZipToPageUrl(data.zip);
      void enrichWithIntelligence(data.zip, data.available, data.demand?.total ?? undefined);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setCheck({ status: "error", message: "Couldn't reach the territory service — try again." });
    }
  }

  function handleZipChange(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, 5);
    setZip(clean);
    if (clean.length === 5) {
      if (check.status !== "result" || check.zip !== clean) void runCheck(clean);
      return;
    }
    if (check.status !== "idle") {
      requestIdRef.current++;
      pendingZipRef.current = null;
      syncZipToPageUrl(null);
      setCheck({ status: "idle" });
      setSubmit({ status: "idle" });
    }
  }

  /** Best-effort personalization/CTA enrichment — never blocks the core check/reserve flow. */
  async function enrichWithIntelligence(zipValue: string, available: boolean, demandTotal?: number) {
    const personalizeResult = await personalization.generate(zipValue);
    if (!personalizeResult?.ok) return;
    await cta.generate({
      zip: zipValue,
      county: personalizeResult.zipContext?.county,
      available,
      demandTotal,
      personalization: personalizeResult.personalization,
    });
  }

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault();
    if (submit.status === "submitting") return;
    if (!form.name.trim() || !form.workEmail.trim() || !form.company.trim()) {
      setSubmit({ status: "error", message: "Name, work email, and company are required." });
      return;
    }
    if (!consent) {
      setSubmit({ status: "error", message: "Please confirm you agree to be contacted." });
      return;
    }
    setSubmit({ status: "submitting" });
    try {
      const { data } = await postJson<{ ok?: boolean; error?: string; message?: string }>(
        "/api/demo-request",
        {
          ...form,
          zip: check.status === "result" ? check.zip : zip,
          source,
          consent,
        },
      );
      if (!data?.ok) {
        setSubmit({ status: "error", message: data?.error ?? "Something went wrong — try again." });
        return;
      }
      setSubmit({ status: "done", message: data.message ?? "You're in — we'll be in touch shortly." });
    } catch {
      setSubmit({ status: "error", message: "Network error — try again in a moment." });
    }
  }

  const showForm = check.status === "result";
  const claimed = check.status === "result" && !check.available;
  const place =
    check.status === "result" && check.city && check.state
      ? `${check.city}, ${check.state}`
      : check.status === "result"
        ? `ZIP ${check.zip}`
        : "";
  const signupHref =
    check.status === "result" && check.available
      ? signupHrefFor(check.zip)
      : signupHrefFor();
  const liveStatus =
    check.status === "checking"
      ? {
          label: `Checking ${zip}…`,
          pill: "border-indigo-300/40 bg-indigo-400/10 text-indigo-200",
          dot: "animate-pulse bg-indigo-300",
          input: "border-indigo-300",
        }
      : check.status === "result" && check.available
        ? {
            label: "Available",
            pill: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
            dot: "bg-emerald-400",
            input: "border-emerald-400",
          }
        : check.status === "result"
          ? {
              label: "Claimed · waitlist",
              pill: "border-amber-300/40 bg-amber-400/10 text-amber-200",
              dot: "bg-amber-400",
              input: "border-amber-400",
            }
          : check.status === "error"
            ? {
                label: "Check failed",
                pill: "border-rose-300/40 bg-rose-400/10 text-rose-200",
                dot: "bg-rose-400",
                input: "border-rose-400",
              }
            : {
                label: zip.length > 0 ? `${zip.length}/5 digits` : "Live",
                pill: "border-white/10 bg-white/5 text-slate-300",
                dot: zip.length > 0 ? "bg-indigo-300" : "animate-pulse bg-emerald-400",
                input: "border-white/20",
              };
  const resultTitle =
    check.status === "result"
      ? check.available
        ? `${place} is open for exclusive claim`
        : `${place} is claimed — join the waitlist`
      : "";

  return (
    <div className="ypn-glass ypn-glow w-full rounded-[28px] p-6 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={zipInputId} className="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-200">
          Real-time ZIP availability
        </label>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${liveStatus.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${liveStatus.dot}`} aria-hidden />
          {liveStatus.label}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={zipInputId}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter ZIP code (e.g. 92672)"
          maxLength={5}
          value={zip}
          aria-invalid={check.status === "error"}
          onChange={(e) => handleZipChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runCheck();
            }
          }}
          className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 transition placeholder:font-normal placeholder:text-slate-400 focus:ring-2 ${liveStatus.input}`}
        />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={check.status === "checking"}
          className="shrink-0 rounded-2xl bg-gradient-to-r from-violet-500 to-violet-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          aria-busy={check.status === "checking"}
        >
          {check.status === "checking" ? "Checking…" : "Check availability"}
        </button>
      </div>

      <div aria-live="polite" role="status" className="mt-4 min-h-[172px]">
        {check.status === "idle" ? (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-slate-400">
              Enter a 5-digit ZIP to see whether the territory is open. Exclusivity begins with a paid plan.
            </p>
            <TierAccessComparison />
          </div>
        ) : null}

        {check.status === "checking" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/5 rounded-full bg-white/20" />
              <div className="h-3 w-full rounded-full bg-white/10" />
              <div className="h-3 w-4/5 rounded-full bg-white/10" />
              <div className="h-9 w-40 rounded-full bg-amber-300/50" />
            </div>
          </div>
        ) : null}

        {check.status === "error" ? (
          <div className="rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-4 text-sm text-rose-100">
            <p className="font-semibold">We could not check that ZIP.</p>
            <p className="mt-1 text-rose-100/80">{check.message}</p>
            <button
              type="button"
              className="mt-3 rounded-full border border-rose-200/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
              onClick={() => void runCheck()}
            >
              Retry check
            </button>
          </div>
        ) : null}

        {check.status === "result" ? (
          <div
            className={`rounded-2xl border px-4 py-4 text-sm font-medium transition ${
              check.available
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : "border-amber-300/40 bg-amber-400/10 text-amber-100"
            }`}
          >
            <p className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-2.5 w-2.5 rounded-full ${check.available ? "bg-emerald-300" : "bg-amber-300"}`}
              />
              <span className="font-semibold">
                {resultTitle}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-white/80">{check.message}</p>
            {check.demandTotal ? (
              <p className="mt-2 text-[12px] text-white/65">
                ~{check.demandTotal} buyers / sellers / movers in the next 60 days
              </p>
            ) : null}
            {check.totalClaimed > 0 ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
                {check.totalClaimed} territories claimed nationwide
              </p>
            ) : null}
            {check.available ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={checkoutUrlForTier("growth", check.zip)}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-4 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  Lock exclusively · 15-day trial
                </a>
                <a
                  href={signupHref}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 text-xs font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                >
                  Start free (no lock)
                </a>
              </div>
            ) : (
              <a
                href={signupHref}
                className="mt-3 inline-flex rounded-full bg-amber-400 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Explore other ZIPs
              </a>
            )}
            <p className="mt-2 text-[12px] text-white/70">
              Availability can change. A free account or inquiry does not lock this territory.
            </p>
            {cta.data?.microNudges?.length ? (
              <ul className="mt-3 space-y-1 text-[12px] leading-5 text-white/70">
                {cta.data.microNudges
                  .filter((nudge) => !nudge.startsWith("~"))
                  .slice(0, 2)
                  .map((nudge) => (
                    <li key={nudge}>{nudge}</li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {showForm && submit.status !== "done" ? (
        <form onSubmit={submitReservation} className="mt-6 grid gap-3 sm:grid-cols-2">
          <p className="sm:col-span-2 text-sm font-semibold text-white">
            {claimed ? "Join the waitlist for this territory" : `Ask about ZIP ${check.zip}`}
          </p>

          <Field
            label="Full name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            autoComplete="name"
            required
          />
          <Field
            label="Work email"
            type="email"
            value={form.workEmail}
            onChange={(v) => setForm((f) => ({ ...f, workEmail: v }))}
            autoComplete="email"
            required
          />
          <Field
            label="Company / brokerage"
            value={form.company}
            onChange={(v) => setForm((f) => ({ ...f, company: v }))}
            autoComplete="organization"
            required
          />
          <Field
            label="Mobile phone"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            autoComplete="tel"
          />

          <label className="text-xs font-medium text-white/70">
            Team size
            <select
              value={form.monthlyLeadVolume}
              onChange={(e) => setForm((f) => ({ ...f, monthlyLeadVolume: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            >
              {VOLUME_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-white/70">
            Role
            <input
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="sm:col-span-2 text-xs font-medium text-white/70">
            Anything we should know? (optional)
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
            />
          </label>

          <label className="sm:col-span-2 flex items-start gap-3 text-xs leading-5 text-white/55">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-1 accent-amber-400"
            />
            YPN USA and an assigned loan officer may contact me by email and, if provided, text or
            phone about this request. Message and data rates may apply; reply STOP to opt out.
          </label>

          {submit.status === "error" ? (
            <p className="sm:col-span-2 text-sm font-medium text-rose-200">{submit.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={submit.status === "submitting"}
            className="sm:col-span-2 mt-1 rounded-2xl bg-amber-400 px-6 py-3 text-base font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          >
            {submit.status === "submitting"
              ? "Submitting…"
              : claimed
                ? "Join the waitlist"
                : "Request territory details"}
          </button>
          <p className="sm:col-span-2 text-[11px] text-white/50">
            Prefer the full signup?{" "}
            <a href={signupHref} className="underline hover:text-white">
              Continue on ypnus.com
            </a>
            . No credit card required.
          </p>
        </form>
      ) : null}

      {submit.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-5 py-5 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {claimed ? "Waitlist request received" : "Territory inquiry received"}
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-100">{submit.message}</p>
          <a
            href={signupHref}
            className="mt-4 inline-flex rounded-full bg-amber-400 px-5 py-2 text-xs font-bold uppercase tracking-wide text-[#09081b] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Finish free setup →
          </a>
        </div>
      ) : null}
    </div>
  );
}

function TierAccessComparison() {
  return (
    <dl className="grid grid-cols-2 gap-2 text-[12px]">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <dt className="font-semibold text-slate-200">Free · Cerebro</dt>
        <dd className="mt-1 leading-snug text-slate-400">AI diagnostic and intake preview. Does not reserve a ZIP.</dd>
      </div>
      <div className="rounded-2xl border border-indigo-400/30 bg-indigo-500/10 p-3">
        <dt className="font-semibold text-indigo-100">Paid · from $99.99/mo</dt>
        <dd className="mt-1 leading-snug text-indigo-100/75">Exclusive ZIP lock and live lead delivery.</dd>
      </div>
    </dl>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-medium text-white/70">
      {label}
      {required ? <span className="text-violet-300"> *</span> : null}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
      />
    </label>
  );
}
