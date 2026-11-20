"use client";

import { useId, useMemo, useState } from "react";
import { track } from "@/lib/track";
import { formatUsd } from "@/lib/format";
import {
  DEFAULT_ASSUMPTIONS,
  PMI_DOWN_PAYMENT_THRESHOLD_PCT,
  downPaymentPercent,
  maxHomePrice,
  paymentBreakdown,
  type PaymentBreakdown,
} from "@/lib/home-calc";

type Mode = "payment" | "budget";

const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: "payment", label: "Monthly payment by home price" },
  { id: "budget", label: "Max home price by monthly budget" },
];

const TERMS = [30, 15] as const;
const toNumber = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

const FIELD =
  "mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-slate-900 outline-none ring-violet-300 focus:ring-2";
const LABEL = "block text-sm font-semibold text-slate-700";

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  prefix,
  suffix,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        {prefix ? <span className="pointer-events-none absolute left-3 top-[1.4rem] text-slate-500">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(toNumber(e.target.value))}
          className={`${FIELD} ${prefix ? "pl-7" : ""} ${suffix ? "pr-9" : ""}`}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-[1.4rem] text-slate-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

function TermField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        Loan term
      </label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={FIELD}>
        {TERMS.map((t) => (
          <option key={t} value={t}>
            {t}-year fixed
          </option>
        ))}
      </select>
    </div>
  );
}

function BreakdownTable({ b, termYears }: { b: PaymentBreakdown; termYears: number }) {
  const rows: Array<[string, string]> = [
    [`Principal & interest (${termYears}-yr)`, formatUsd(b.principalAndInterest)],
    ["Est. property tax", formatUsd(b.propertyTax)],
    ["Est. homeowners insurance", formatUsd(b.insurance)],
    [
      b.downPaymentPct < PMI_DOWN_PAYMENT_THRESHOLD_PCT ? "Est. PMI (under 20% down)" : "PMI (20% or more down)",
      b.pmi > 0 ? formatUsd(b.pmi) : "$0",
    ],
  ];
  return (
    <table className="mt-4 w-full text-sm">
      <caption className="sr-only">Estimated monthly payment breakdown</caption>
      <tbody>
        {rows.map(([name, amount]) => (
          <tr key={name} className="border-t border-slate-200">
            <th scope="row" className="py-2 pr-3 text-left font-medium text-slate-700">
              {name}
            </th>
            <td className="py-2 text-right font-semibold text-slate-900">{amount}</td>
          </tr>
        ))}
        <tr className="border-t-2 border-slate-300">
          <th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-900">
            Estimated total
          </th>
          <td className="py-2 text-right text-lg font-bold text-violet-800">{formatUsd(b.total)}/mo</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Preview of the white-label client calculator a loan officer gets on their own pages, branded
 * with their name and NMLS number. The preview uses placeholder branding and example numbers.
 */
export function ClientCalculatorPreview({ claimHref = "#claim", source = "home" }: { claimHref?: string; source?: string }) {
  const [mode, setMode] = useState<Mode>("payment");
  const [homePrice, setHomePrice] = useState(450_000);
  const [downPayment, setDownPayment] = useState(45_000);
  const [rate, setRate] = useState(6.5);
  const [termYears, setTermYears] = useState<number>(30);
  const [budget, setBudget] = useState(3_200);
  const [budgetDownPct, setBudgetDownPct] = useState(10);

  const downPct = round2(downPaymentPercent(homePrice, downPayment));
  const payment = useMemo(
    () => paymentBreakdown({ homePrice, downPayment, annualRatePct: rate, termYears }),
    [homePrice, downPayment, rate, termYears],
  );
  const affordability = useMemo(
    () => maxHomePrice({ monthlyBudget: budget, downPaymentPct: budgetDownPct, annualRatePct: rate, termYears }),
    [budget, budgetDownPct, rate, termYears],
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-xl">
      <div className="flex flex-col gap-1 border-b border-slate-200 bg-[#13254a] px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold">
          Your Name &middot; NMLS #000000 <span className="font-normal text-white/70">(preview branding)</span>
        </p>
        <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Client calculator preview</p>
      </div>

      <div className="p-5 sm:p-8">
        <div role="group" aria-label="Calculator type" className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                mode === m.id ? "border-violet-700 bg-violet-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "payment" ? (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Home price" prefix="$" step={5000} value={homePrice} onChange={setHomePrice} />
              <NumberField label="Interest rate (example)" suffix="%" step={0.125} max={25} value={rate} onChange={setRate} />
              <NumberField label="Down payment" prefix="$" step={1000} value={downPayment} onChange={(n) => setDownPayment(Math.min(n, homePrice))} />
              <NumberField
                label="Down payment %"
                suffix="%"
                step={0.5}
                max={100}
                value={downPct}
                onChange={(n) => setDownPayment(Math.round((homePrice * Math.min(n, 100)) / 100))}
              />
              <TermField value={termYears} onChange={setTermYears} />
            </div>
            <div aria-live="polite">
              <p className="text-sm font-semibold text-slate-600">Estimated monthly payment</p>
              <p className="text-4xl font-bold text-violet-800">{formatUsd(payment.total)}</p>
              <p className="mt-1 text-sm text-slate-600">
                on a {formatUsd(payment.loanAmount)} loan, {downPct}% down
              </p>
              <BreakdownTable b={payment} termYears={termYears} />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="Monthly budget (all-in)" prefix="$" step={100} value={budget} onChange={setBudget} />
              <NumberField label="Interest rate (example)" suffix="%" step={0.125} max={25} value={rate} onChange={setRate} />
              <NumberField label="Down payment %" suffix="%" step={0.5} max={100} value={budgetDownPct} onChange={(n) => setBudgetDownPct(Math.min(n, 100))} />
              <TermField value={termYears} onChange={setTermYears} />
            </div>
            <div aria-live="polite">
              <p className="text-sm font-semibold text-slate-600">Estimated max home price</p>
              <p className="text-4xl font-bold text-violet-800">{formatUsd(Math.round(affordability.maxHomePrice / 1000) * 1000)}</p>
              <p className="mt-1 text-sm text-slate-600">
                with about {formatUsd(Math.round(affordability.downPayment))} down and a {formatUsd(Math.round(affordability.loanAmount))} loan
              </p>
              <BreakdownTable b={affordability.breakdown} termYears={termYears} />
            </div>
          </div>
        )}

        <p className="mt-6 text-xs leading-relaxed text-slate-600">
          Example numbers, not a rate quote or loan offer. Estimates assume property tax of {DEFAULT_ASSUMPTIONS.taxRatePct}% of the home price a
          year, homeowners insurance of {DEFAULT_ASSUMPTIONS.insuranceRatePct}% and PMI of {DEFAULT_ASSUMPTIONS.pmiRatePct}% of the loan when
          you put less than {PMI_DOWN_PAYMENT_THRESHOLD_PCT}% down. Real figures depend on the property, the borrower and the lender, and
          exclude HOA dues and mortgage insurance premiums on FHA, VA or USDA loans.
        </p>

        <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">
            On your pages this calculator carries <span className="font-semibold">your name and NMLS #</span>. Claim your exclusive ZIP code to
            get yours.
          </p>
          <a
            href={claimHref}
            onClick={() => track("calculator_preview_cta", { source, mode })}
            className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-[#09081b] shadow-lg shadow-amber-500/30 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            Check &amp; claim my ZIP code &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
