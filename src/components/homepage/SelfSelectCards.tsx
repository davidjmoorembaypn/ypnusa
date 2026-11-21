"use client";

import type { VisitorIntent } from "@/lib/analytics-behavior";

interface SelfSelectOption {
  intent: VisitorIntent;
  icon: string;
  label: string;
  sub: string;
}

const OPTIONS: SelfSelectOption[] = [
  { intent: "buying", icon: "🏡", label: "I'm buying a home", sub: "See buyer pre-approval steps" },
  { intent: "refinancing", icon: "🔄", label: "I'm refinancing", sub: "Check today's refi options" },
  { intent: "mlo", icon: "🤝", label: "I'm a mortgage officer", sub: "Claim your exclusive ZIP code" },
];

export function SelfSelectCards({
  selected,
  onSelect,
}: {
  selected: VisitorIntent | null;
  onSelect: (intent: VisitorIntent) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="What brings you here today?">
      {OPTIONS.map((option) => {
        const isSelected = selected === option.intent;
        return (
          <button
            key={option.intent}
            type="button"
            onClick={() => onSelect(option.intent)}
            aria-pressed={isSelected}
            className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3.5 text-left transition duration-200 hover:-translate-y-0.5 ${
              isSelected
                ? "border-emerald-700 bg-emerald-50 ring-1 ring-emerald-700"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }`}
          >
            <span className="text-xl" aria-hidden>
              {option.icon}
            </span>
            <span className="text-sm font-semibold text-slate-900">{option.label}</span>
            <span className="text-xs text-slate-700">{option.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
