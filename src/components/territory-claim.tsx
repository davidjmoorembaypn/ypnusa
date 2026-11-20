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
    setCheck({ status: "idle" });
    setSubmit({ status: "idle" });
    setDetailsState("idle");
    setZip("");
    zipInputRef.current?.focus();
  }

  async function runCheck(override?: string) {
    if (check.status === "checking") return;
    const clean = (override ?? zip).replace(/\D/g, "").slice(0, 5);
    // A new lookup: drop the previous ZIP code's nudges now, not when (or if) new ones arrive.
    cta.reset();
    syncZipToPageUrl(null);
    setZip(clean);
    if (clean.length !== 5) {
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

  return (
    <div className="w-full rounded-[28px] border border-white/15 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
      <label htmlFor={zipInputId} className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-200">
        Is your ZIP code open? Free, instant, no login
      </label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id={zipInputId}
          ref={zipInputRef}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter ZIP code (e.g. 92672)"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runCheck();
            }
          }}
          className="min-h-[52px] w-full rounded-2xl border border-white/20 bg-white px-4 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none ring-violet-300 transition placeholder:font-normal placeholder:text-slate-500 focus:ring-2"
        />
        <button
          type="button"
          onClick={() => void runCheck()}
          disabled={check.status === "checking"}
          className="min-h-[52px] shrink-0 rounded-2xl bg-amber-400 px-6 py-3 text-base font-bold text-[#09081b] shadow-lg shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          aria-busy={check.status === "checking"}
        >
          {check.status === "checking" ? "Checking…" : "Check my ZIP code"}
        </button>
      </div>

      <div aria-live="polite" role="status" className="mt-4 min-h-[172px]">
        {check.status === "idle" ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-white/70">
            <p className="font-medium text-white">See it before you sign up</p>
            <p className="mt-1 text-[13px]">
              Enter a 5-digit ZIP code to see if it&rsquo;s open and an estimate of how many households buy, sell or move there in 60 days. Checking
              doesn&rsquo;t reserve a ZIP code; it locks at your first payment on a paid plan.
            </p>
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
            <p className="font-semibold">We could not check that ZIP code.</p>
            <p className="mt-1 text-rose-100/80">{check.message}</p>
            <button
              type="button"
              className="mt-3 min-h-[44px] rounded-full border border-rose-200/40 px-5 py-2 text-xs font-semibold uppercase tracking-wide transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
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
            {check.city && check.state ? <p className="mt-1 text-[12px] text-white/70">{place}</p> : null}
            <p className="mt-1 text-[13px] text-white/80">{check.message}</p>
            {check.demandTotal ? (
              <p className="mt-2 text-[12px] text-white/65">
                About {check.demandTotal} households buy, sell or move in over a typical 60 days (Census-based estimate, not a lead count)
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
                  href={payNowUrlForTier("growth", check.zip) ?? checkoutUrlForTier("growth", check.zip)}
                  onClick={() => { track("begin_checkout", { plan: "growth", zip: check.zip, source, checkout: "pay_now" }); trackFunnel("checkout_started", { plan: "growth", checkout: "pay_now", source }); }}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-center text-sm font-bold text-[#09081b] shadow-lg shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 sm:col-span-2"
                >
                  Claim my exclusive ZIP code {check.zip} →
                </a>
                <a
                  href={checkoutUrlForTier("growth", check.zip)}
                  onClick={() => { track("begin_checkout", { plan: "growth", zip: check.zip, source, checkout: "trial" }); trackFunnel("checkout_started", { plan: "growth", checkout: "trial", source }); }}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/40 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Start 15-day free trial
                </a>
                <a
                  href={signupHref}
                  onClick={() => track("sign_up_click", { plan: "free", source })}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full px-5 py-3 text-center text-sm font-semibold text-white/85 underline underline-offset-2 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  Start on the Free plan
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={tryAnotherZip}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-5 py-3 text-sm font-bold text-[#09081b] transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                Check an adjacent ZIP code →
              </button>
            )}
            <p className="mt-2 text-[12px] text-white/70">
              {check.available
                ? "Pro plan, $99/mo, cancel anytime. Claiming now pays the first month and locks your ZIP code today. The 15-day trial lets you try the tools first, but someone who pays sooner can take the ZIP code."
                : "Join the waitlist below and we'll tell you if this ZIP code opens up."}
            </p>
            {activeNudges.length ? (
              <ul className="mt-3 space-y-1 text-[12px] leading-5 text-white/70">
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
          <p className="text-sm font-semibold text-white">
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

          <label className="flex items-start gap-3 text-xs leading-5 text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-amber-400"
            />
            YPN USA and an assigned loan officer may contact me by email and, if provided, text or
            phone about this request. Message and data rates may apply; reply STOP to opt out.
          </label>

          {submit.status === "error" ? (
            <p role="alert" className="text-sm font-medium text-rose-200">{submit.message}</p>
          ) : null}

          <button
            type="submit"
            disabled={submit.status === "submitting"}
            className="mt-1 min-h-[52px] rounded-2xl bg-amber-400 px-6 py-3 text-base font-bold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:translate-y-0 disabled:cursor-wait disabled:opacity-60"
          >
            {submit.status === "submitting"
              ? "Sending…"
              : claimed
                ? "Join the waitlist"
                : `Send me ZIP code ${check.zip} details`}
          </button>
          <p className="text-[11px] text-white/60">Takes about 20 seconds. This does not reserve a ZIP code.</p>
        </form>
      ) : null}

      {submit.status === "done" ? (
        <div className="mt-6 rounded-2xl border border-emerald-300/40 bg-emerald-400/10 px-5 py-5">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
            {claimed ? "Waitlist request received" : "Request received"}
          </p>
          <p className="mt-2 text-center text-sm font-semibold text-emerald-100">{submit.message}</p>

          {submit.id && (detailsState === "idle" || detailsState === "saving") ? (
            <form onSubmit={saveDetails} className="mt-5 border-t border-emerald-300/20 pt-4">
              <p className="text-sm font-semibold text-white">Optional: help us prepare</p>
              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-white/75">Team size</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {VOLUME_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={details.monthlyLeadVolume === opt}
                      onClick={() => setDetails((d) => ({ ...d, monthlyLeadVolume: d.monthlyLeadVolume === opt ? "" : opt }))}
                      className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                        details.monthlyLeadVolume === opt
                          ? "border-amber-300 bg-amber-400 text-[#09081b]"
                          : "border-white/25 bg-white/5 text-white hover:bg-white/10"
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
                  className="min-h-[44px] rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#09081b] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-wait disabled:opacity-60"
                >
                  {detailsState === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsState("skipped")}
                  className="min-h-[44px] px-2 text-sm font-semibold text-white/75 underline underline-offset-2 hover:text-white"
                >
                  Skip
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 text-center">
              {detailsState === "saved" ? (
                <p className="text-xs text-emerald-100/80">Thanks, that helps us prepare.</p>
              ) : detailsState === "failed" ? (
                <p role="status" className="text-xs text-amber-100">
                  We couldn&rsquo;t save those extra details, but your request is in. We&rsquo;ll ask when we reach out.
                </p>
              ) : null}
              <a
                href={signupHref}
                className="mt-3 inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-[#09081b] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
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
    <label className="block text-xs font-medium text-white/80">
      {label}
      {required ? <span className="text-amber-300"> *</span> : null}
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-1 min-h-[48px] w-full rounded-xl border border-white/20 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:ring-2 focus:ring-violet-300"
      />
    </label>
  );
}
