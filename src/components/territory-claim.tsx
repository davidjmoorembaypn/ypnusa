"use client";

import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/track";
import { trackFunnel } from "@/lib/funnel-events";
import { postJson } from "@/lib/client-api";
import { FREE_SIGNUP_HREF, checkoutUrlForTier, payNowUrlForTier } from "@/lib/checkout";
import { PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { usePersonalization } from "@/lib/hooks/usePersonalization";
import { useCTAEngine } from "@/lib/hooks/useCTAEngine";
import { ctaForZip, nudgesWithoutDemand } from "@/lib/cta/ctaEngine";
import { ZipHint, ZipInput } from "@/components/zip-input";
import {
  ZIP_STORAGE_KEY,
  isCompleteZip,
  publishZipStatus,
  sanitizeZip,
  syncZipToPageUrl,
} from "@/lib/zip-session";

// PricingCta and older imports read these from here; the store itself lives in lib/zip-session.
export { ZIP_CHECKED_EVENT, ZIP_STORAGE_KEY } from "@/lib/zip-session";

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
  | { status: "done"; message: string; id?: string }
  | { status: "error"; message: string };

/** Optional step 2 after the short form (progressive profiling). */
type DetailsState = "idle" | "saving" | "saved" | "skipped" | "failed";

const VOLUME_OPTIONS = [
  "Just me (solo LO)",
  "2–5 loan officers",
  "6–20 loan officers",
  "Whole brokerage / branch",
];



/** "$299 Exclusive / $199 Growth / $99 Pro", from the public price list so the copy can't drift from /pricing. */
const LOCK_PLAN_PRICES = (["elite", "pro", "growth"] as const)
  .map((id) => PUBLIC_PRICING_TIERS.find((tier) => tier.id === id))
  .flatMap((tier) => (tier ? [`${tier.price} ${tier.name}`] : []))
  .join(" / ");

export function TerritoryClaim({ source = "territory_section" }: { source?: string }) {
  const zipInputId = useId();
  const zipHintId = `${zipInputId}-hint`;
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [zip, setZip] = useState("");
  const autoChecked = useRef(false);
  const [check, setCheck] = useState<CheckState>({ status: "idle" });
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });
  const [consent, setConsent] = useState(false);
  const personalization = usePersonalization();
  const cta = useCTAEngine();

  // Short form: three fields and consent. Company and team size are asked after the
  // first submit, as an optional one-tap step, so nobody faces a long form up front.
  const [form, setForm] = useState({
    name: "",
    workEmail: "",
    phone: "",
  });
  const [details, setDetails] = useState({ company: "", monthlyLeadVolume: "" });
  const [detailsState, setDetailsState] = useState<DetailsState>("idle");

  // A ZIP handed over in the URL (e.g. /claim-territory?zip=93720 from the ZIP demand
  // check) is prefilled and checked right away, so the visitor never types it twice.
  useEffect(() => {
    if (autoChecked.current) return;
    autoChecked.current = true;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("zip");
      const remembered = sessionStorage.getItem(ZIP_STORAGE_KEY);
      // A ZIP handed over in the URL is checked right away (the visitor asked for it). One only
      // remembered from earlier is just prefilled: checking it unprompted would grow the card
      // after load and push the page down (layout shift), and the visitor is one tap away.
      if (fromUrl && /^\d{5}$/.test(fromUrl)) void runCheck(fromUrl);
      // Deferred a tick so the prefill isn't a synchronous state update inside the effect.
      else if (remembered && /^\d{5}$/.test(remembered)) void Promise.resolve().then(() => setZip(remembered));
    } catch {
      /** noop — prefill is a convenience only. */
    }
    // runCheck is stable enough for a one-time mount effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tryAnotherZip() {
    cta.reset();
    syncZipToPageUrl(null);
    publishZipStatus(null);
    setCheck({ status: "idle" });
    setSubmit({ status: "idle" });
    setDetailsState("idle");
    setZip("");
    zipInputRef.current?.focus();
  }

  async function runCheck(override?: string) {
    if (check.status === "checking") return;
    const clean = sanitizeZip(override ?? zip);
    // A new lookup: drop the previous ZIP code's nudges now, not when (or if) new ones arrive.
    cta.reset();
    syncZipToPageUrl(null);
    publishZipStatus(null);
    setZip(clean);
    if (!isCompleteZip(clean)) {
      setCheck({ status: "error", message: "Enter a valid 5-digit ZIP code." });
      return;
    }
    setCheck({ status: "checking" });
    setSubmit({ status: "idle" });
    try {
      const res = await fetch(`/api/territory/check?zip=${encodeURIComponent(clean)}`, {
        signal: AbortSignal.timeout(15_000),
      });
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
        demand?: { total?: number; buyers?: number } | null;
        source?: string | null;
      };
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
      publishZipStatus({ zip: data.zip, available: data.available, city: data.city, state: data.state });
      track("zip_check", { zip: data.zip, available: data.available, source });
      void enrichWithIntelligence(data.zip, data.available, data.demand?.total ?? undefined);
    } catch {
      setCheck({ status: "error", message: "Couldn't reach the territory service — try again." });
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
    if (!form.name.trim() || !form.workEmail.trim()) {
      setSubmit({ status: "error", message: "Please enter your name and work email." });
      return;
    }
    if (!consent) {
      setSubmit({ status: "error", message: "Please confirm you agree to be contacted." });
      return;
    }
    setSubmit({ status: "submitting" });
    try {
      const { data } = await postJson<{ ok?: boolean; error?: string; message?: string; id?: string }>(
        "/api/demo-request",
        {
          ...form,
          role: "Loan officer",
          zip: check.status === "result" ? check.zip : zip,
          source,
          consent,
        },
      );
      if (!data?.ok) {
        setSubmit({ status: "error", message: data?.error ?? "Something went wrong — try again." });
        return;
      }
      track("generate_lead", { source, method: "territory_reservation" });
      setSubmit({ status: "done", message: data.message ?? "You're in — we'll be in touch shortly.", id: data.id });
      setDetailsState("idle");
    } catch {
      setSubmit({ status: "error", message: "Network error — try again in a moment." });
    }
  }

  /** Step 2 (optional): company and team size, saved onto the inquiry just created. */
  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (submit.status !== "done" || !submit.id || detailsState === "saving") return;
    if (!details.company.trim() && !details.monthlyLeadVolume) {
      setDetailsState("skipped");
      return;
    }
    setDetailsState("saving");
    // Step 2 is optional and the inquiry is already saved, so a failure never blocks the
    // visitor; it just isn't reported (or tracked) as saved.
    let saved = false;
    try {
      const res = await fetch("/api/demo-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: submit.id, ...details }),
        signal: AbortSignal.timeout(15_000),
      });
      saved = res.ok;
    } catch {
      saved = false;
    }
    if (saved) track("lead_details_added", { source, team_size: details.monthlyLeadVolume || undefined });
    setDetailsState(saved ? "saved" : "failed");
  }

  // Only nudges built for the ZIP code on screen, and not the demand line (shown above already).
  const activeCta = ctaForZip(cta.data, check.status === "result" ? check.zip : null);
  const activeNudges = activeCta ? nudgesWithoutDemand(activeCta).slice(0, 2) : [];
  const showForm = check.status === "result";
  const claimed = check.status === "result" && !check.available;
  const place =
    check.status === "result" && check.city && check.state
      ? `${check.city}, ${check.state}`
      : check.status === "result"
        ? `ZIP code ${check.zip}`
        : "";
  // A free account doesn't lock a ZIP (only a paid plan does), so no ZIP rides along.
  const signupHref = FREE_SIGNUP_HREF;
  const resultTitle =
    check.status === "result"
      ? check.available
        ? `ZIP ${check.zip} is AVAILABLE — Lock out all competing YPN USA MLOs in this ZIP code (${LOCK_PLAN_PRICES}).`
        : `ZIP ${check.zip} is LOCKED by another MLO — Join the priority waitlist or check adjacent ZIP codes.`
      : "";

  const ready = isCompleteZip(zip);
  const checking = check.status === "checking";

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl shadow-slate-900/10 sm:p-6 md:p-8">
      <label htmlFor={zipInputId} className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-800">
        Is your ZIP code open? Free, instant, no login
      </label>
      <div className="mt-3 flex gap-2 sm:gap-3">
        <ZipInput
          id={zipInputId}
          inputRef={zipInputRef}
          value={zip}
          onValueChange={(next) => {
            setZip(next);
            if (check.status === "error") setCheck({ status: "idle" });
          }}
          onEnter={() => void runCheck()}
          invalid={check.status === "error"}
          describedBy={zipHintId}
          placeholder="e.g. 93618"
          className="min-h-[52px] w-full min-w-0 flex-1 rounded-2xl border border-slate-400 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 placeholder:font-normal placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={checking}
          data-ready={ready ? "true" : "false"}
          className={`min-h-[52px] shrink-0 whitespace-nowrap rounded-2xl border-2 border-emerald-700 px-4 py-3 text-base font-bold transition duration-200 disabled:cursor-wait disabled:opacity-70 sm:px-6 ${
            ready ? "bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 hover:bg-emerald-800" : "bg-white text-emerald-800 hover:bg-emerald-50"
          }`}
          aria-busy={checking}
        >
          {checking ? (
            "Checking…"
          ) : (
            <>
              <span className="sm:hidden">Check ZIP</span>
              <span className="hidden sm:inline">Check my ZIP code</span>
            </>
          )}
        </button>
      </div>
      <ZipHint
        id={zipHintId}
        zip={zip}
        error={check.status === "error" ? check.message : null}
        idleText="Checking is free and doesn't reserve a ZIP code. It locks at your first payment on a paid plan."
      />

      <div aria-live="polite" role="status">
        {checking ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 w-3/5 rounded-full bg-slate-300" />
              <div className="h-3 w-full rounded-full bg-slate-200" />
              <div className="h-9 w-40 rounded-full bg-emerald-200" />
            </div>
          </div>
        ) : null}

        {check.status === "result" ? (
          <div
            className={`mt-3 rounded-2xl border px-4 py-4 text-sm font-medium ${
              check.available ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
            }`}
          >
            <p className="flex items-start gap-2">
              <span
                aria-hidden
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${check.available ? "bg-emerald-600" : "bg-amber-600"}`}
              />
              <span className={`font-semibold ${check.available ? "text-emerald-950" : "text-amber-950"}`}>{resultTitle}</span>
            </p>
            {check.city && check.state ? <p className="mt-1 text-[12px] text-slate-700">{place}</p> : null}
            <p className="mt-1 text-[13px] text-slate-800">{check.message}</p>
            {check.demandTotal ? (
              <p className="mt-2 text-[12px] text-slate-700">
                About {check.demandTotal} households buy, sell or move in over a typical 60 days (Census-based estimate, not a lead count)
              </p>
            ) : null}
            {check.totalClaimed > 0 ? (
              <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-600">
                {check.totalClaimed} territories claimed nationwide
              </p>
            ) : null}
            {check.available ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={payNowUrlForTier("growth", check.zip) ?? checkoutUrlForTier("growth", check.zip)}
                  onClick={() => { track("begin_checkout", { plan: "growth", zip: check.zip, source, checkout: "pay_now" }); trackFunnel("checkout_started", { plan: "growth", checkout: "pay_now", source }); }}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-700 px-5 py-3 text-center text-sm font-bold text-white shadow-lg shadow-emerald-900/20 transition duration-200 hover:bg-emerald-800 sm:col-span-2"
                >
                  Lock ZIP code {check.zip} today (first payment now) →
                </a>
                <a
                  href={checkoutUrlForTier("growth", check.zip)}
                  onClick={() => { track("begin_checkout", { plan: "growth", zip: check.zip, source, checkout: "trial" }); trackFunnel("checkout_started", { plan: "growth", checkout: "trial", source }); }}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-400 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Start 15-day free trial (no ZIP lock)
                </a>
                <a
                  href={signupHref}
                  onClick={() => track("sign_up_click", { plan: "free", source })}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full px-5 py-3 text-center text-sm font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
                >
                  Start on the Free plan
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={tryAnotherZip}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition duration-200 hover:bg-emerald-800"
              >
                Check an adjacent ZIP code →
              </button>
            )}
            <p className="mt-2 text-[12px] text-slate-700">
              {check.available
                ? "Pro plan, $99/mo, cancel anytime. Claiming now pays the first month and locks your ZIP code today. The 15-day trial lets you try the tools first, but someone who pays sooner can take the ZIP code."
                : "Join the waitlist below and we'll tell you if this ZIP code opens up."}
            </p>
            {activeNudges.length ? (
              <ul className="mt-3 space-y-1 text-[12px] leading-5 text-slate-700">
                {activeNudges.map((nudge) => (
                  <li key={nudge}>{nudge}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {showForm && submit.status !== "done" ? (
        <form onSubmit={submitReservation} className="mt-6 grid gap-3" noValidate>
          <p className="text-sm font-semibold text-slate-900">
            {claimed ? "Join the waitlist for this ZIP code" : `Not ready to claim? Get the details for ZIP code ${check.zip}`}
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
            inputMode="email"
            value={form.workEmail}
            onChange={(v) => setForm((f) => ({ ...f, workEmail: v }))}
            autoComplete="email"
            required
          />
          <Field
            label="Mobile phone (optional)"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            autoComplete="tel"
          />

          <label className="flex items-start gap-3 text-xs leading-5 text-slate-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-700"
            />
            YPN USA and an assigned loan officer may contact me by email and, if provided, text or
            phone about this request. Message and data rates may apply; reply STOP to opt out.
          </label>

          {submit.status === "error" ? (
            <p role="alert" className="text-sm font-semibold text-rose-700">{submit.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={submit.status === "submitting"}
            className="mt-1 min-h-[52px] rounded-2xl border border-slate-400 bg-white px-6 py-3 text-base font-bold text-slate-900 transition duration-200 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {submit.status === "submitting"
              ? "Sending…"
              : claimed
                ? "Join the waitlist"
                : `Send me ZIP code ${check.zip} details`}
          </button>
          <p className="text-[11px] text-slate-600">Takes about 20 seconds. This does not reserve a ZIP code.</p>
        </form>
      ) : null}

      {submit.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-5">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-emerald-900">
            {claimed ? "Waitlist request received" : "Request received"}
          </p>
          <p className="mt-2 text-center text-sm font-semibold text-emerald-950">{submit.message}</p>

          {submit.id && (detailsState === "idle" || detailsState === "saving") ? (
            <form onSubmit={saveDetails} className="mt-5 border-t border-emerald-200 pt-4">
              <p className="text-sm font-semibold text-slate-900">Optional: help us prepare</p>
              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-slate-700">Team size</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {VOLUME_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={details.monthlyLeadVolume === opt}
                      onClick={() => setDetails((d) => ({ ...d, monthlyLeadVolume: d.monthlyLeadVolume === opt ? "" : opt }))}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        details.monthlyLeadVolume === opt
                          ? "border-emerald-700 bg-emerald-700 text-white"
                          : "border-slate-400 bg-white text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="mt-3">
                <Field
                  label="Company or brokerage (optional)"
                  value={details.company}
                  onChange={(v) => setDetails((d) => ({ ...d, company: v }))}
                  autoComplete="organization"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={detailsState === "saving"}
                  className="min-h-[44px] rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {detailsState === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsState("skipped")}
                  className="min-h-[44px] px-2 text-sm font-semibold text-slate-700 underline underline-offset-2 hover:text-slate-900"
                >
                  Skip
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 text-center">
              {detailsState === "saved" ? (
                <p className="text-xs text-emerald-900">Thanks, that helps us prepare.</p>
              ) : detailsState === "failed" ? (
                <p role="status" className="text-xs text-amber-900">
                  We couldn&rsquo;t save those extra details, but your request is in. We&rsquo;ll ask when we reach out.
                </p>
              ) : null}
              <a
                href={signupHref}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Create my free account →
              </a>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-800">
      {label}
      {required ? <span className="text-rose-700"> *</span> : null}
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-400 bg-white px-3 py-2 text-base text-slate-900"
      />
    </label>
  );
}
