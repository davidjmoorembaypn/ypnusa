"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import type { UpgradeOptions } from "@/lib/upgrade-options";

/** Why the slide-over opened: sets its headline. */
export interface UpgradeRequest {
  zip?: string;
  reason: "lead" | "zip" | "cerebro" | "autopilot";
}

const HEADLINES: Record<UpgradeRequest["reason"], (zip?: string) => string> = {
  lead: (zip) => (zip ? `Unlock this borrower and claim ZIP code ${zip}` : "Unlock this borrower"),
  zip: (zip) => (zip ? `Claim ZIP code ${zip} exclusively` : "Claim your ZIP code exclusively"),
  cerebro: () => "Let Cerebro do the work, every day",
  autopilot: () => "Turn on Cerebro's autopilot",
};

/** Adds the ZIP code as Stripe's client_reference_id: the webhook locks it at the first payment. */
function withZip(link: string, zip?: string): string {
  if (!zip) return link;
  try {
    const url = new URL(link, window.location.origin);
    if (url.hostname === "buy.stripe.com") url.searchParams.set("client_reference_id", zip);
    else url.searchParams.set("zip", zip);
    return url.toString();
  } catch {
    return link;
  }
}

/**
 * free: no paid plan, so checkout locks the ZIP code at the first payment.
 * trial: a paid plan still in its trial (its ZIP code isn't locked yet); a second checkout would
 *   create a second subscription, so locking it sooner is arranged with support.
 * owner: already holds an included ZIP code; more ZIP codes are add-ons arranged with support.
 */
export type UpgradeMode = "free" | "trial" | "owner";

export function TerritoryUpgradeModal(props: {
  request: UpgradeRequest | null;
  options: UpgradeOptions;
  mode: UpgradeMode;
  /** The ZIP code the viewer chose (onboarding or the lead feed), used when the request names none. */
  defaultZip: string | null;
  onClose: () => void;
}) {
  const { request, options, mode, defaultZip, onClose } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const open = request !== null;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!request) return null;
  const titleId = "upgrade-slideover-title";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 text-slate-900 shadow-2xl outline-none sm:p-8"
      >
        <SlideOverBody
          key={`${request.reason}:${request.zip ?? ""}`}
          request={request}
          options={options}
          mode={mode}
          defaultZip={defaultZip}
          titleId={titleId}
          onClose={onClose}
        />
      </div>
    </div>
  );
}

function SlideOverBody(props: {
  request: UpgradeRequest;
  options: UpgradeOptions;
  mode: UpgradeMode;
  defaultZip: string | null;
  titleId: string;
  onClose: () => void;
}) {
  const { request, options, mode, defaultZip, titleId, onClose } = props;
  const [typedZip, setTypedZip] = useState("");
  const typedClean = typedZip.replace(/\D/g, "").slice(0, 5);
  // Checkout must carry a ZIP code, or the payment would lock none: ask for one when we have none.
  const zip = request.zip ?? defaultZip ?? (typedClean.length === 5 ? typedClean : undefined);
  const headline = HEADLINES[request.reason](zip);

  function onCheckout(kind: string) {
    track("upgrade_checkout_click", { kind, reason: request.reason, zip_set: Boolean(zip), mode });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">
            {mode === "owner" ? "Add a ZIP code" : `${options.planName} plan`}
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold leading-tight">
            {headline}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          aria-label="Close"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 fill-current">
            <path d="M5.3 4.3a1 1 0 0 0-1.4 1.4L8.6 10l-4.7 4.3a1 1 0 1 0 1.4 1.4L10 11.4l4.3 4.3a1 1 0 0 0 1.4-1.4L11.4 10l4.3-4.3a1 1 0 0 0-1.4-1.4L10 8.6 5.3 4.3Z" />
          </svg>
        </button>
      </div>

      {mode === "owner" ? (
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            Your plan includes one exclusive ZIP code. More ZIP codes are add-ons, subject to availability, and we set
            them up with you.
          </p>
          <a
            href={`mailto:${options.supportEmail}?subject=${encodeURIComponent(`Add ZIP code ${request.zip ?? ""} to my plan`.trim())}`}
            onClick={() => onCheckout("add_zip_email")}
            className="inline-flex w-full items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-base font-semibold text-white hover:bg-violet-800"
          >
            {request.zip ? `Ask to add ZIP code ${request.zip}` : "Ask to add a ZIP code"}
          </a>
        </div>
      ) : mode === "trial" ? (
        <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            You&rsquo;re in your free trial. Your ZIP code locks to you at your first payment, and until then another
            loan officer can still claim it.
          </p>
          <p>To lock it today, ask us to start your billing now. You keep the same plan.</p>
          <a
            href={`mailto:${options.supportEmail}?subject=${encodeURIComponent(`Start my billing now and lock ZIP code ${zip ?? ""}`.trim())}`}
            onClick={() => onCheckout("trial_lock_email")}
            className="inline-flex w-full items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-base font-semibold text-white hover:bg-violet-800"
          >
            {zip ? `Lock ZIP code ${zip} now` : "Lock my ZIP code now"}
          </a>
        </div>
      ) : !zip ? (
        <form
          className="mt-6 space-y-3"
          onSubmit={(event) => event.preventDefault()}
          aria-label="Choose your ZIP code"
        >
          <label htmlFor="upgrade-zip" className="block text-sm font-medium text-slate-700">
            Which ZIP code do you want to own?
          </label>
          <input
            id="upgrade-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={typedZip}
            onChange={(event) => setTypedZip(event.target.value)}
            placeholder="5-digit ZIP code"
            className="w-full rounded-full border border-slate-300 px-4 py-3 text-base focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <p className="text-xs text-slate-500">Your checkout options appear once you enter it.</p>
        </form>
      ) : (
        <CheckoutOptions zip={zip} options={options} onCheckout={onCheckout} />
      )}
    </>
  );
}

function CheckoutOptions(props: { zip: string; options: UpgradeOptions; onCheckout: (kind: string) => void }) {
  const { zip, options, onCheckout } = props;
  return (
    <>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {`ZIP code ${zip} locks to you the moment your first payment goes through. Requests from it then come straight to you, with full contact details.`}
      </p>
      <div className="mt-6 space-y-3">
        {options.payNowUrl ? (
          <a
            href={withZip(options.payNowUrl, zip)}
            onClick={() => onCheckout("pay_now")}
            className="block rounded-2xl border-2 border-violet-700 bg-violet-700 px-5 py-4 text-white shadow-sm transition hover:bg-violet-800"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold">Pay now and lock it today</span>
              <span className="text-lg font-semibold">{options.monthlyPrice}/mo</span>
            </span>
            <span className="mt-1 block text-sm text-violet-100">Cancel anytime. Your ZIP code stays yours while you&rsquo;re subscribed.</span>
          </a>
        ) : null}

        {options.prepaidUrl ? (
          <a
            href={withZip(options.prepaidUrl, zip)}
            onClick={() => onCheckout("prepaid_5y")}
            className="block rounded-2xl border border-slate-200 px-5 py-4 transition hover:border-violet-400 hover:bg-violet-50"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-base font-semibold">Lock it for {options.prepaidYears} years</span>
              <span className="text-lg font-semibold">{options.prepaidPrice}</span>
            </span>
            <span className="mt-1 block text-sm text-slate-600">One payment. Full refund within {options.prepaidRefundDays} days.</span>
          </a>
        ) : null}

        <a
          href={withZip(options.trialUrl, zip)}
          onClick={() => onCheckout("trial")}
          className="block rounded-2xl border border-slate-200 px-5 py-4 transition hover:border-violet-400 hover:bg-violet-50"
        >
          <span className="text-base font-semibold">Try it free for {options.trialDays} days</span>
          <span className="mt-1 block text-sm text-slate-600">
            The trial doesn&rsquo;t lock your ZIP code: it locks at your first payment.
          </span>
        </a>
      </div>

      <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">{options.planName} includes</h3>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {options.includes.map((item) => (
          <li key={item} className="flex gap-2">
            <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 fill-emerald-600">
              <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z" />
            </svg>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Link href={options.pricingHref} className="mt-6 text-sm font-semibold text-violet-700 hover:text-violet-900">
        Compare all plans
      </Link>
    </>
  );
}
