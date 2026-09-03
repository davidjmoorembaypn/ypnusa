"use client";

import { useMemo, useState } from "react";

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0,
  );

/**
 * Low-friction pre-qualification slider — no fields to type into, just drag.
 * Designed to be the "stay engaged 2+ minutes" loop: every drag reports an
 * interaction signal upstream (via onInteract), and the estimate updates
 * instantly so there's always a reason to keep adjusting.
 */
export function InteractiveCalculator({ onInteract }: { onInteract?: () => void }) {
  const [income, setIncome] = useState(95000);
  const [downPaymentPct, setDownPaymentPct] = useState(10);

  const { estimatedPreQualification, estimatedMonthly } = useMemo(() => {
    // Rough, conservative rule-of-thumb estimate (not a real underwriting calc) —
    // purely to give the slider an instant, satisfying result to react to.
    const maxAffordablePrice = (income / 12 / 0.36) * 12 * 3.2;
    const downPayment = maxAffordablePrice * (downPaymentPct / 100);
    const loanAmount = maxAffordablePrice - downPayment;
    const monthlyRate = 6.7 / 100 / 12;
    const n = 30 * 12;
    const monthly = monthlyRate === 0 ? loanAmount / n : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    return { estimatedPreQualification: maxAffordablePrice, estimatedMonthly: monthly };
  }, [income, downPaymentPct]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="ic-income" className="text-sm font-semibold text-slate-700">
              Annual household income
            </label>
            <span className="text-lg font-bold text-violet-700">{usd(income)}</span>
          </div>
          <input
            id="ic-income"
            type="range"
            min={30000}
            max={400000}
            step={5000}
            value={income}
            onChange={(event) => {
              setIncome(Number(event.target.value));
              onInteract?.();
            }}
            className="mt-2 w-full accent-violet-600"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="ic-down" className="text-sm font-semibold text-slate-700">
              Down payment
            </label>
            <span className="text-lg font-bold text-violet-700">{downPaymentPct}%</span>
          </div>
          <input
            id="ic-down"
            type="range"
            min={0}
            max={30}
            step={1}
            value={downPaymentPct}
            onChange={(event) => {
              setDownPaymentPct(Number(event.target.value));
              onInteract?.();
            }}
            className="mt-2 w-full accent-violet-600"
          />
        </div>
      </div>

      <div className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 text-center sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Est. pre-qualification</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{usd(estimatedPreQualification)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Est. monthly payment</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{usd(estimatedMonthly)}/mo</p>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        Rough estimate only, not a loan offer or credit decision. Your loan officer will run real numbers.
      </p>
    </div>
  );
}
