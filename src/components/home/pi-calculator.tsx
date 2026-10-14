"use client";

import { useMemo, useState } from "react";
import { formatUsd } from "@/lib/format";

interface SliderProps {
  id: string;
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
}

function Slider({ id, label, display, min, max, step, value, onChange, minLabel, maxLabel }: SliderProps) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-300">
          {label}
        </label>
        <output htmlFor={id} className="text-lg font-semibold tabular-nums text-white">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ypn-range mt-4 w-full"
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
      />
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function PiCalculator() {
  const [amount, setAmount] = useState(450000);
  const [rate, setRate] = useState(6.5);
  const [term, setTerm] = useState(30);

  const { monthly, totalInterest, principalShare } = useMemo(() => {
    const r = rate / 100 / 12;
    const n = term * 12;
    const m = r === 0 ? amount / n : (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const interest = m * n - amount;
    return { monthly: m, totalInterest: interest, principalShare: (amount / (amount + interest)) * 100 };
  }, [amount, rate, term]);

  return (
    <div className="ypn-glass ypn-glow grid gap-8 rounded-3xl p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr] lg:p-10">
      <div className="flex flex-col gap-8">
        <Slider
          id="pi-amount"
          label="Loan amount"
          display={formatUsd(amount)}
          min={50000}
          max={2000000}
          step={5000}
          value={amount}
          onChange={setAmount}
          minLabel="$50K"
          maxLabel="$2M"
        />
        <Slider
          id="pi-rate"
          label="Interest rate"
          display={`${rate.toFixed(2)}%`}
          min={2}
          max={12}
          step={0.125}
          value={rate}
          onChange={setRate}
          minLabel="2%"
          maxLabel="12%"
        />
        <Slider
          id="pi-term"
          label="Loan term"
          display={`${term} years`}
          min={10}
          max={30}
          step={5}
          value={term}
          onChange={setTerm}
          minLabel="10 yrs"
          maxLabel="30 yrs"
        />
      </div>

      <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200">
            Estimated monthly P&amp;I
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight text-white" aria-live="polite">
            {formatUsd(monthly)}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {term}-year fixed at {rate.toFixed(2)}%
          </p>
        </div>

        <div className="mt-8">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-white/10"
            role="img"
            aria-label={`Principal is ${Math.round(principalShare)}% of total payments`}
          >
            <div className="bg-gradient-to-r from-violet-500 to-indigo-500" style={{ width: `${principalShare}%` }} />
            <div className="flex-1 bg-sky-400/70" />
          </div>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="flex items-center gap-2 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden />
                Principal
              </dt>
              <dd className="font-semibold tabular-nums text-white">{formatUsd(amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-2 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden />
                Total interest
              </dt>
              <dd className="font-semibold tabular-nums text-white">{formatUsd(totalInterest)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2">
              <dt className="text-slate-300">Total of payments</dt>
              <dd className="font-semibold tabular-nums text-white">{formatUsd(amount + totalInterest)}</dd>
            </div>
          </dl>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-slate-500">
          Principal and interest only. Excludes taxes, insurance, HOA, and mortgage insurance. Estimates are for
          illustration and are not a loan offer or rate quote.
        </p>
      </div>
    </div>
  );
}
