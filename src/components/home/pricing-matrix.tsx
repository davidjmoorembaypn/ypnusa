"use client";

import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { PricingCta } from "@/components/pricing-cta";
import { PUBLIC_PRICING_TIERS, TRIAL_DAYS, type PricingTierId } from "@/lib/pricing";

type PublicTierId = Exclude<PricingTierId, "starter">;

const MATRIX: { feature: string; tiers: PublicTierId[] }[] = [
  { feature: "Cerebro AI growth diagnostic", tiers: ["free", "growth", "pro", "elite"] },
  { feature: "AI borrower intake + scoring", tiers: ["free", "growth", "pro", "elite"] },
  { feature: "100% lead and data ownership", tiers: ["free", "growth", "pro", "elite"] },
  { feature: "Exclusive ZIP lock (1 included)", tiers: ["growth", "pro", "elite"] },
  { feature: "Live lead delivery", tiers: ["growth", "pro", "elite"] },
  { feature: "SMS + email nurture ladders", tiers: ["growth", "pro", "elite"] },
  { feature: "Calendar booking + CRM mirroring", tiers: ["growth", "pro", "elite"] },
  { feature: "Portable MLO website + domain", tiers: ["pro", "elite"] },
  { feature: "Priority lead delivery", tiers: ["pro", "elite"] },
  { feature: "Advanced life-event signals", tiers: ["pro", "elite"] },
  { feature: "Priority territory add-on access", tiers: ["elite"] },
  { feature: "Unlimited automation runs", tiers: ["elite"] },
  { feature: "White-glove onboarding", tiers: ["elite"] },
];

const btnBase =
  "mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

export function PricingMatrix() {
  const [trial, setTrial] = useState(true);
  const tiers = PUBLIC_PRICING_TIERS;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-center">
        <div className="ypn-glass inline-flex items-center gap-4 rounded-full py-2 pl-5 pr-2">
          <span id="trial-toggle-label" className="text-sm font-medium text-slate-200">
            Show {TRIAL_DAYS}-day free trial pricing
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={trial}
            aria-labelledby="trial-toggle-label"
            onClick={() => setTrial((t) => !t)}
            className={`relative h-8 w-14 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
              trial ? "bg-gradient-to-r from-violet-500 to-indigo-500" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${trial ? "left-7" : "left-1"}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => {
          const paid = tier.id !== "free";
          return (
            <li
              key={tier.id}
              className={`relative flex flex-col rounded-3xl p-6 ${tier.highlight ? "ypn-glass ypn-glow" : "ypn-glass"}`}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-violet-500 to-sky-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
              <p className="mt-1 min-h-10 text-[13px] leading-snug text-slate-400">{tier.tagline}</p>

              <div className="mt-5 min-h-20">
                {paid && trial ? (
                  <>
                    <p className="text-4xl font-semibold tracking-tight text-white">
                      $0
                      <span className="ml-1 text-sm font-medium text-slate-400">for {TRIAL_DAYS} days</span>
                    </p>
                    <p className="mt-1 text-[13px] text-indigo-200">
                      then {tier.price}
                      {tier.cadence}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-semibold tracking-tight text-white">
                      {tier.price}
                      <span className="ml-1 text-sm font-medium text-slate-400">{tier.cadence}</span>
                    </p>
                    <p className="mt-1 text-[13px] text-slate-500">
                      {paid ? "Billed monthly · cancel anytime" : "No credit card required"}
                    </p>
                  </>
                )}
              </div>

              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-slate-300">
                {tier.zipCapacityLabel}
              </p>

              <PricingCta
                tierId={tier.id}
                className={`${btnBase} ${
                  tier.highlight
                    ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:brightness-110"
                    : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                }`}
              >
                {paid ? `Start ${TRIAL_DAYS}-day free trial` : "Start free"}
              </PricingCta>
            </li>
          );
        })}
      </ul>

      <div className="ypn-glass overflow-x-auto rounded-3xl">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">Feature comparison by plan</caption>
          <thead>
            <tr className="border-b border-white/10">
              <th scope="col" className="px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Feature
              </th>
              {tiers.map((t) => (
                <th
                  key={t.id}
                  scope="col"
                  className={`px-4 py-4 text-center text-sm font-semibold ${t.highlight ? "text-indigo-200" : "text-white"}`}
                >
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.feature} className="border-b border-white/5 last:border-0">
                <th scope="row" className="px-6 py-3.5 font-normal text-slate-300">
                  {row.feature}
                </th>
                {tiers.map((t) => {
                  const included = row.tiers.includes(t.id as PublicTierId);
                  return (
                    <td key={t.id} className={`px-4 py-3.5 text-center ${t.highlight ? "bg-indigo-500/[0.06]" : ""}`}>
                      {included ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-400" aria-label="Included" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-slate-600" aria-label="Not included" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-[12px] text-slate-500">
        Each paid plan includes one exclusive ZIP. Additional ZIPs are paid add-ons, subject to availability. Free
        accounts never reserve a territory.
      </p>
    </div>
  );
}
