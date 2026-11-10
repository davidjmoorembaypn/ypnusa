"use client";

import { useId, useState } from "react";
import { formatUsd } from "@/lib/format";
import {
  compensationPerLoanCents,
  loansToCoverPlan,
  parseDollarInput,
  parseNumberInput,
  roiPlanOptions,
  type CompensationMode,
} from "@/lib/roi";

const PLAN_OPTIONS = roiPlanOptions();

/** Dollars from cents, showing cents only when there are some ($799.80, $1,188). */
function money(cents: number): string {
  return formatUsd(cents / 100, cents % 100 === 0 ? 0 : 2);
}

/**
 * /roi calculator: average loan amount + compensation (basis points or a flat amount per loan)
 * + plan -> loans per year needed to cover the plan, with the arithmetic shown. Only the
 * visitor's numbers and our prices go in; nothing here predicts leads or closings.
 */
export function RoiLoansCalculator() {
  const id = useId();
  const [loanAmount, setLoanAmount] = useState("350,000");
  const [mode, setMode] = useState<CompensationMode>("bps");
  const [bps, setBps] = useState("100");
  const [flat, setFlat] = useState("");
  const [planId, setPlanId] = useState(PLAN_OPTIONS[0].id);

  const loanAmountValue = parseDollarInput(loanAmount);
  const bpsValue = parseNumberInput(bps);
  const flatValue = parseDollarInput(flat);
  const plan = PLAN_OPTIONS.find((option) => option.id === planId) ?? PLAN_OPTIONS[0];
  const comp = compensationPerLoanCents({ mode, loanAmountDollars: loanAmountValue, bps: bpsValue, flatDollars: flatValue });
  const result = loansToCoverPlan(comp, plan.yearlyCents);

  const inputClass =
    "mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:border-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-600/30";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-plan`} className="block text-sm font-semibold">
            Plan
          </label>
          <select id={`${id}-plan`} value={planId} onChange={(event) => setPlanId(event.target.value)} className={inputClass}>
            {PLAN_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} ({money(option.yearlyCents)}/yr)
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="block text-sm font-semibold">How you&rsquo;re paid</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                ["bps", "Basis points"],
                ["flat", "Per loan"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold ${
                  mode === value ? "border-violet-700 bg-violet-50 text-violet-900" : "border-slate-300 text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-mode`}
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "bps" ? (
          <>
            <div>
              <label htmlFor={`${id}-amount`} className="block text-sm font-semibold">
                Average loan amount ($)
              </label>
              <input
                id={`${id}-amount`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={loanAmount}
                onChange={(event) => setLoanAmount(event.target.value)}
                aria-invalid={(loanAmount.trim() !== "" && loanAmountValue === null) || undefined}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${id}-bps`} className="block text-sm font-semibold">
                Compensation (basis points)
              </label>
              <input
                id={`${id}-bps`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={bps}
                onChange={(event) => setBps(event.target.value)}
                aria-describedby={`${id}-bps-hint`}
                aria-invalid={(bps.trim() !== "" && bpsValue === null) || undefined}
                className={inputClass}
              />
              <p id={`${id}-bps-hint`} className="mt-1 text-xs text-slate-600">
                100 basis points = 1% of the loan amount.
              </p>
            </div>
          </>
        ) : (
          <div className="sm:col-span-2">
            <label htmlFor={`${id}-flat`} className="block text-sm font-semibold">
              Compensation per closed loan ($)
            </label>
            <input
              id={`${id}-flat`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="2,500"
              value={flat}
              onChange={(event) => setFlat(event.target.value)}
              aria-invalid={(flat.trim() !== "" && flatValue === null) || undefined}
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div aria-live="polite" className="mt-6 rounded-2xl bg-slate-50 p-5">
        {result && comp !== null ? (
          <>
            <p className="text-lg text-slate-900">
              <strong className="text-2xl">{result.wholeLoans}</strong> extra closed {result.wholeLoans === 1 ? "loan" : "loans"} a
              year covers {plan.label}.
            </p>
            <p className="mt-3 font-mono text-sm text-slate-700">
              {mode === "bps" && loanAmountValue !== null && bpsValue !== null
                ? `${formatUsd(loanAmountValue)} × ${bpsValue} bps ÷ 10,000 = ${money(comp)} per loan`
                : `${money(comp)} per loan`}
            </p>
            <p className="mt-1 font-mono text-sm text-slate-700">
              {money(plan.yearlyCents)} a year ÷ {money(comp)} = {result.exact.toFixed(2)} loans → {result.wholeLoans}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-700">Enter your loan amount and compensation to see the result.</p>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-600">
        Illustration only, not a promise of leads or loans. Your results depend on your market, your follow-up and your
        compensation plan.
      </p>
    </div>
  );
}
