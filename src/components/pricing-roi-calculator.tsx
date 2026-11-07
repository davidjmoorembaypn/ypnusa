"use client";

import { useId, useMemo, useState } from "react";
import { formatUsd } from "@/lib/format";
import { computeRoi, formatCoverage, parseDollarInput, parseLoanCountInput, planYearlyCosts } from "@/lib/roi";

const YEARLY_COSTS = planYearlyCosts();

/**
 * "One extra closed loan pays for YPN many times over": the visitor types their own average
 * commission per closed loan (and, optionally, how many extra loans a year to model), and the
 * calculator shows how many times that covers each plan's yearly cost. Only the visitor's
 * numbers and our prices go in; nothing here predicts leads or closings.
 */
export function PricingRoiCalculator() {
  const id = useId();
  const commissionId = `${id}-commission`;
  const loansId = `${id}-loans`;
  const loansHintId = `${id}-loans-hint`;
  const disclaimerId = `${id}-disclaimer`;

  const [commission, setCommission] = useState("");
  const [loans, setLoans] = useState("1");

  const commissionValue = parseDollarInput(commission);
  const loansValue = parseLoanCountInput(loans);
  const commissionInvalid = commission.trim() !== "" && commissionValue === null;
  const loansInvalid = loansValue === null;

  const result = useMemo(() => computeRoi(commissionValue, loansValue), [commissionValue, loansValue]);
  const loanWord = loansValue === 1 ? "loan" : "loans";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={commissionId} className="block text-sm font-semibold text-slate-900">
            Your average commission per closed loan
          </label>
          <div className="relative mt-2">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-500">
              $
            </span>
            <input
              id={commissionId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="3,000"
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
              aria-invalid={commissionInvalid || undefined}
              aria-describedby={disclaimerId}
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white py-3 pl-8 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />
          </div>
          {commissionInvalid ? (
            <p className="mt-1 text-xs text-rose-700" role="alert">
              Enter a dollar amount, like 3,000.
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor={loansId} className="block text-sm font-semibold text-slate-900">
            Extra closed loans per year <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id={loansId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={loans}
            onChange={(event) => setLoans(event.target.value)}
            aria-invalid={loansInvalid || undefined}
            aria-describedby={loansHintId}
            className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
          <p id={loansHintId} className="mt-1 text-xs text-slate-500">
            Leave at 1 to see what a single extra loan a year covers.
          </p>
        </div>
      </div>

      <div aria-live="polite" className="mt-6">
        {result ? (
          <p className="text-sm text-slate-700">
            {formatNumber(loansValue ?? 1)} extra {loanWord} a year at {formatUsd(commissionValue ?? 0)} ={" "}
            <strong className="text-slate-900">{formatUsd(result.extraCommissionYearlyCents / 100)}</strong> in extra commission.
          </p>
        ) : (
          <p className="text-sm text-slate-600">Enter your average commission to see how many times it covers each plan.</p>
        )}
      </div>

      <ul className="mt-4 grid gap-4 md:grid-cols-3">
        {YEARLY_COSTS.map((plan) => {
          const row = result?.rows.find((candidate) => candidate.tierId === plan.tierId);
          return (
            <li key={plan.tierId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-base font-semibold text-slate-900">{plan.name}</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-600">Monthly plan, per year</dt>
                  <dd className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{formatUsd(plan.monthlyPlanYearlyCents / 100)}</span>
                    {row ? <span className="font-semibold text-violet-700">covered {formatCoverage(row.monthlyCoverage)}</span> : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">5-year plan, per year</dt>
                  <dd className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{formatUsd(plan.prepaidYearlyCents / 100)}</span>
                    {row ? <span className="font-semibold text-violet-700">covered {formatCoverage(row.prepaidCoverage)}</span> : null}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <p id={disclaimerId} className="mt-5 text-xs leading-relaxed text-slate-600">
        Illustration only — your results depend on your market and follow-up; YPN doesn&apos;t guarantee leads or loans.
      </p>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
