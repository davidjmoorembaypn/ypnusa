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
  { intent: "mlo", icon: "🤝", label: "I'm a mortgage officer", sub: "Claim your exclusive ZIP" },
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
            className={`flex flex-col items-start gap-1 rounded-2xl border px-4 py-3.5 text-left transition duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${
              isSelected
                ? "border-amber-300 bg-amber-400/15 ring-1 ring-amber-300/60"
                : "border-white/20 bg-white/5 hover:bg-white/10"
            }`}
          >
            <span className="text-xl" aria-hidden>
              {option.icon}
            </span>
            <span className="text-sm font-semibold text-white">{option.label}</span>
            <span className="text-xs text-white/65">{option.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
