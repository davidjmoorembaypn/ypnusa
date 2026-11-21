"use client";

import { useId, useState } from "react";
import { PricingCta } from "@/components/pricing-cta";
import { formatUsd } from "@/lib/format";
import { track } from "@/lib/track";
import { useZipStatus } from "@/lib/zip-session";
import { MobileCollapse } from "./mobile-collapse";
import {
  PREPAID_5Y,
  PREPAID_5Y_REFUND_WINDOW_DAYS,
  PREPAID_5Y_YEARS,
  PUBLIC_MONTHLY_PRICE_CENTS,
  PUBLIC_PRICING_TIERS,
  prepaid5ySavingsRatio,
  type CurrentPaidTierId,
  type PricingTier,
} from "@/lib/pricing";
import { BTN_ACCENT, BTN_PRIMARY, BTN_SECONDARY } from "./ui";

type Billing = "monthly" | "prepaid_5y";

const PRO_MONTHLY_DOLLARS = PUBLIC_MONTHLY_PRICE_CENTS.growth / 100;

/** The trial is offered by the second button on every paid card, so it isn't repeated in the feature list. */
const TRIAL_FEATURE = /15-day free trial/i;

function isPaid(tier: PricingTier): tier is PricingTier & { id: CurrentPaidTierId } {
  return tier.id === "growth" || tier.id === "pro" || tier.id === "elite";
}

/**
 * "1 closed loan = $X commission, covering Y months of Pro": two sliders, the visitor's own
 * numbers and our price. Arithmetic only; it predicts no leads, loans or income.
 */
function CommissionRoiBar() {
  const id = useId();
  const [loanAmount, setLoanAmount] = useState(400_000);
  const [bps, setBps] = useState(125);
  const commission = Math.round((loanAmount * bps) / 10_000);
  const months = Math.floor(commission / PRO_MONTHLY_DOLLARS);
  /** One event when a slider is released, not one per pixel dragged. */
  const report = (field: "loan_amount" | "bps") =>
    track("home_roi_adjust", { field, loan_amount: loanAmount, bps, commission, months_of_pro: months });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" data-testid="commission-roi">
      <div className="grid gap-5 md:grid-cols-[1fr_1fr_1.35fr] md:items-center md:gap-8">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${id}-loan`} className="text-sm font-semibold text-slate-900">
              Average Loan Amount
            </label>
            <output htmlFor={`${id}-loan`} className="text-base font-bold text-slate-900">
              {formatUsd(loanAmount)}
            </output>
          </div>
          <input
            id={`${id}-loan`}
            type="range"
            min={100_000}
            max={1_500_000}
            step={10_000}
            value={loanAmount}
            onChange={(event) => setLoanAmount(Number(event.target.value))}
            onPointerUp={() => report("loan_amount")}
            onKeyUp={() => report("loan_amount")}
            aria-valuetext={formatUsd(loanAmount)}
            className="mt-2 h-11 w-full accent-emerald-700"
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${id}-bps`} className="text-sm font-semibold text-slate-900">
              Commission / Comp (bps)
            </label>
            <output htmlFor={`${id}-bps`} className="text-base font-bold text-slate-900">
              {bps} bps
            </output>
          </div>
          <input
            id={`${id}-bps`}
            type="range"
            min={25}
            max={300}
            step={5}
            value={bps}
            onChange={(event) => setBps(Number(event.target.value))}
            onPointerUp={() => report("bps")}
            onKeyUp={() => report("bps")}
            aria-valuetext={`${bps} basis points`}
            className="mt-2 h-11 w-full accent-emerald-700"
          />
        </div>
        <p aria-live="polite" className="rounded-2xl bg-emerald-50 px-4 py-3 text-base leading-snug text-slate-900 ring-1 ring-emerald-200">
          1 closed loan = <strong className="text-emerald-900">{formatUsd(commission)}</strong> commission &mdash; covering{" "}
          <strong className="text-emerald-900">
            {months} month{months === 1 ? "" : "s"}
          </strong>{" "}
          of Pro (${PRO_MONTHLY_DOLLARS}/mo).
        </p>
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Simple math on your own numbers (loan amount &times; basis points). Your actual compensation depends on your comp plan. Not a
        promise of leads, loans or income.
      </p>
    </div>
  );
}

/** ROI bar, the Monthly vs. 5-Year Territory Lock toggle, and the four plan cards. */
export function HomePricing() {
  const [billing, setBilling] = useState<Billing>("monthly");
  const prepaid = billing === "prepaid_5y";
  const termsId = useId();
  // A "lock" checkout only locks a ZIP code if one travels with the payment. Until the visitor
  // has checked an open ZIP code, the lock buttons send them to the ZIP code check, not to Stripe.
  const zipStatus = useZipStatus();
  const lockableZip = zipStatus?.available ? zipStatus.zip : null;
  const proSavings = Math.round(prepaid5ySavingsRatio("growth") * 100);

  return (
    <div>
      <CommissionRoiBar />

      <div className="mt-8 flex flex-col items-center gap-3">
        <div role="group" aria-label="Billing" className="inline-flex max-w-full rounded-full border border-slate-400 bg-white p-1">
          {(
            [
              ["monthly", "Monthly"],
              ["prepaid_5y", "5-Year Territory Lock"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={billing === value}
              onClick={() => {
                if (billing !== value) track("home_billing_toggle", { billing: value });
                setBilling(value);
              }}
              className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold transition sm:px-6 ${
                billing === value ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-slate-100"
              }`}
            >
              {label}
              {value === "prepaid_5y" ? (
                <span className={`ml-2 hidden whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline ${billing === value ? "bg-amber-400 text-slate-900" : "bg-amber-100 text-amber-950"}`}>
                  Save {proSavings}%
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="max-w-2xl text-center text-sm text-slate-700" aria-live="polite">
          {prepaid
            ? `One payment locks your ZIP code the day you pay and keeps it yours for ${PREPAID_5Y_YEARS} years, for about a third less than paying monthly.`
            : "Monthly plans, cancel anytime. Your ZIP code locks at your first payment, not during a trial."}
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {PUBLIC_PRICING_TIERS.map((tier) => {
          const paid = isPaid(tier);
          const plan = paid ? PREPAID_5Y[tier.id] : null;
          const showPrepaid = prepaid && plan;
          const saved = plan ? (plan.monthlyEquivalentCents - plan.priceCents) / 100 : 0;
          return (
            <article
              key={tier.id}
              className={`flex min-h-full flex-col rounded-3xl border bg-white p-6 text-slate-900 ${
                tier.highlight ? "border-emerald-700 shadow-xl shadow-emerald-900/10 ring-2 ring-emerald-700" : "border-slate-200 shadow-sm"
              }`}
            >
              {tier.highlight ? (
                <span className="mb-3 inline-flex w-fit rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-900">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold">{tier.name}</h3>
              <p className="mt-1 text-sm text-slate-700">{tier.tagline}</p>

              {showPrepaid ? (
                <div className="mt-5">
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                    <span className="text-4xl font-bold">{formatUsd(plan.priceCents / 100)}</span>
                    <span className="pb-1 text-sm text-slate-700">once, for {PREPAID_5Y_YEARS} years</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-emerald-800">
                    Save {formatUsd(saved)} vs. {tier.price}/mo for {PREPAID_5Y_YEARS} years ({formatUsd(plan.monthlyEquivalentCents / 100)})
                  </p>
                </div>
              ) : (
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="pb-1 text-sm text-slate-700">{tier.cadence}</span>
                </div>
              )}

              <MobileCollapse label={`See what's in ${tier.name}`} name={`plan_features_${tier.id}`} className="mt-6 flex-1">
              <ul className="space-y-3 text-sm">
                {tier.features
                  .filter((feature) => !(paid && TRIAL_FEATURE.test(feature)))
                  .map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span aria-hidden className="font-bold text-emerald-700">
                        ✓
                      </span>
                      <span className="text-slate-800">{feature}</span>
                    </li>
                  ))}
                {showPrepaid ? (
                  <li className="flex items-start gap-2">
                    <span aria-hidden className="font-bold text-emerald-700">
                      ✓
                    </span>
                    <span className="font-semibold text-slate-900">ZIP code locked to you for {PREPAID_5Y_YEARS} years from payment</span>
                  </li>
                ) : null}
              </ul>
              </MobileCollapse>

              {paid ? (
                <div className="mt-6 grid gap-2 md:mt-8">
                  {!lockableZip ? (
                    <>
                      <a
                        href="#claim"
                        onClick={() => track("home_cta_click", { cta: "pricing_lock_needs_zip", plan: tier.id, billing })}
                        className={`${showPrepaid ? BTN_ACCENT : BTN_PRIMARY} w-full`}
                      >
                        {showPrepaid ? `Lock ZIP for ${PREPAID_5Y_YEARS} Years (One Payment)` : "Lock ZIP Today (First Payment Now)"}
                      </a>
                      <p className="text-center text-xs text-slate-700">Check your ZIP code first, so it is locked with your payment.</p>
                    </>
                  ) : showPrepaid ? (
                    <PricingCta tierId={tier.id} variant="prepaid_5y" aria-describedby={termsId} className={`${BTN_ACCENT} w-full`}>
                      Lock ZIP {lockableZip} for {PREPAID_5Y_YEARS} Years (One Payment)
                    </PricingCta>
                  ) : (
                    <PricingCta tierId={tier.id} variant="pay_now" className={`${BTN_PRIMARY} w-full`}>
                      Lock ZIP {lockableZip} Today (First Payment Now)
                    </PricingCta>
                  )}
                  <PricingCta tierId={tier.id} variant="trial" className={`${BTN_SECONDARY} w-full`}>
                    Start 15-Day Free Trial (No ZIP Lock)
                  </PricingCta>
                </div>
              ) : (
                <div className="mt-6 grid gap-2 md:mt-8">
                  <PricingCta tierId={tier.id} className={`${BTN_SECONDARY} w-full`}>
                    Start Free (No ZIP Lock)
                  </PricingCta>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <p id={termsId} className="mx-auto mt-6 max-w-3xl text-center text-sm text-slate-700">
        {prepaid
          ? `5-year plans: full refund within ${PREPAID_5Y_REFUND_WINDOW_DAYS} days of purchase; no refunds after ${PREPAID_5Y_REFUND_WINDOW_DAYS} days. A refund releases your ZIP code.`
          : "The Free plan and 15-day trials don't lock a ZIP code. It locks at your first payment on a paid plan, so another loan officer who pays first can take it."}
      </p>
    </div>
  );
}
