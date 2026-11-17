"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
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

type ZipCheck =
  | { zip: string; status: "open" | "yours" }
  | { zip: string; status: "taken"; nearby: string[] }
  | { zip: string; status: "error" };

/** Asks the server whether this ZIP code is still open before any payment button shows. */
async function checkZip(zip: string): Promise<ZipCheck> {
  try {
    const res = await fetch(`/api/territory/claimable?zip=${encodeURIComponent(zip)}`, { cache: "no-store" });
    const body = (await res.json()) as { ok?: boolean; available?: boolean; yours?: boolean; nearby?: string[] };
    if (!res.ok || !body.ok) return { zip, status: "error" };
    if (body.yours) return { zip, status: "yours" };
    if (body.available) return { zip, status: "open" };
    return { zip, status: "taken", nearby: Array.isArray(body.nearby) ? body.nearby : [] };
  } catch {
    return { zip, status: "error" };
  }
}

const cleanZip = (value: string) => value.replace(/\D/g, "").slice(0, 5);

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
  const [chosenZip, setChosenZip] = useState<string | null>(null);
  const [otherZip, setOtherZip] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [check, setCheck] = useState<(ZipCheck & { attempt: number }) | null>(null);
  const typedClean = cleanZip(typedZip);
  // Checkout must carry a ZIP code, or the payment would lock none: ask for one when we have none.
  // An owner's default ZIP code is the one they already hold, so it's never a pick for an add-on.
  const zip =
    chosenZip ??
    request.zip ??
    (mode === "owner" ? undefined : (defaultZip ?? (typedClean.length === 5 ? typedClean : undefined)));

  useEffect(() => {
    if (!zip) return;
    let live = true;
    checkZip(zip).then((result) => {
      if (live) setCheck({ ...result, attempt });
    });
    return () => {
      live = false;
    };
  }, [zip, attempt]);

  const current = check && check.zip === zip && check.attempt === attempt ? check : null;
  const taken = current?.status === "taken";
  const headline = taken ? `ZIP code ${zip} is already taken` : HEADLINES[request.reason](zip);

  function onCheckout(kind: string) {
    track("upgrade_checkout_click", { kind, reason: request.reason, zip_set: Boolean(zip), mode });
  }

  function pick(next: string) {
    track("upgrade_zip_repick", { reason: request.reason, mode });
    setOtherZip("");
    setChosenZip(next);
  }

  let body: ReactNode;
  if (!zip) {
    body =
      mode === "owner" ? (
        <OwnerAddZip options={options} onCheckout={onCheckout} />
      ) : (
        <form className="mt-6 space-y-3" onSubmit={(event) => event.preventDefault()} aria-label="Choose your ZIP code">
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
          <p className="text-xs text-slate-500">We check it&rsquo;s open, then show your checkout options.</p>
        </form>
      );
  } else if (!current) {
    body = (
      <p className="mt-6 text-sm text-slate-600" role="status">
        Checking that ZIP code {zip} is still open&hellip;
      </p>
    );
  } else if (current.status === "error") {
    body = (
      <div className="mt-6 space-y-3 text-sm text-slate-700" role="alert">
        <p>We couldn&rsquo;t confirm ZIP code {zip} is still open, so checkout is paused.</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-full border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50"
        >
          Check again
        </button>
      </div>
    );
  } else if (current.status === "taken") {
    const otherClean = cleanZip(otherZip);
    body = (
      <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
        <p>Another loan officer already holds it, and each ZIP code has one owner. Pick an open one to continue.</p>
        {current.nearby.length > 0 ? (
          <div>
            <p className="font-medium text-slate-900">Open nearby</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {current.nearby.map((open) => (
                <button
                  key={open}
                  type="button"
                  onClick={() => pick(open)}
                  className="rounded-full border border-violet-300 bg-violet-50 px-4 py-2 font-semibold text-violet-800 hover:bg-violet-100"
                >
                  {open}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <form
          className="flex gap-2"
          aria-label="Try another ZIP code"
          onSubmit={(event) => {
            event.preventDefault();
            if (otherClean.length === 5) pick(otherClean);
          }}
        >
          <input
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={otherZip}
            onChange={(event) => setOtherZip(event.target.value)}
            placeholder="Another ZIP code"
            aria-label="Another ZIP code"
            className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-base focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <button
            type="submit"
            disabled={otherClean.length !== 5}
            className="rounded-full bg-violet-700 px-4 py-2 font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
          >
            Check
          </button>
        </form>
      </div>
    );
  } else if (current.status === "yours") {
    body = <p className="mt-6 text-sm leading-6 text-slate-700">ZIP code {zip} is already yours.</p>;
  } else if (mode === "owner") {
    body = <OwnerAddZip zip={zip} options={options} onCheckout={onCheckout} />;
  } else if (mode === "trial") {
    body = (
      <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
        <p>
          You&rsquo;re in your free trial. Your ZIP code locks to you at your first payment, and until then another
          loan officer can still claim it.
        </p>
        <p>To lock it today, ask us to start your billing now. You keep the same plan.</p>
        <a
          href={`mailto:${options.supportEmail}?subject=${encodeURIComponent(`Start my billing now and lock ZIP code ${zip}`)}`}
          onClick={() => onCheckout("trial_lock_email")}
          className="inline-flex w-full items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-base font-semibold text-white hover:bg-violet-800"
        >
          {`Lock ZIP code ${zip} now`}
        </a>
      </div>
    );
  } else {
    body = <CheckoutOptions zip={zip} options={options} onCheckout={onCheckout} />;
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
      {body}
    </>
  );
}

function OwnerAddZip(props: { zip?: string; options: UpgradeOptions; onCheckout: (kind: string) => void }) {
  const { zip, options, onCheckout } = props;
  return (
    <div className="mt-6 space-y-4 text-sm leading-6 text-slate-700">
      <p>
        Your plan includes one exclusive ZIP code. More ZIP codes are add-ons, subject to availability, and we set them
        up with you.
      </p>
      <a
        href={`mailto:${options.supportEmail}?subject=${encodeURIComponent(`Add ZIP code ${zip ?? ""} to my plan`.trim())}`}
        onClick={() => onCheckout("add_zip_email")}
        className="inline-flex w-full items-center justify-center rounded-full bg-violet-700 px-5 py-3 text-base font-semibold text-white hover:bg-violet-800"
      >
        {zip ? `Ask to add ZIP code ${zip}` : "Ask to add a ZIP code"}
      </a>
    </div>
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
