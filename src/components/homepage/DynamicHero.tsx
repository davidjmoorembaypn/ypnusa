"use client";

import type { DynamicHeroCopy } from "@/lib/analytics-behavior";

/**
 * Swaps only the eyebrow badge + primary CTA of the hero based on the
 * visitor's resolved content variant — the rest of the hero (headline,
 * stats, territory-claim form) stays constant so this can't destabilize
 * layout or SEO-relevant copy.
 */
export function DynamicHero({ copy }: { copy: DynamicHeroCopy }) {
  return (
    <>
      <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-900">
        {copy.eyebrow}
      </span>
      <a
        href={copy.primaryCtaHref}
        className="inline-flex items-center justify-center rounded-full bg-emerald-700 px-7 py-3.5 text-sm font-bold text-white shadow-sm transition duration-200 hover:bg-emerald-800"
      >
        {copy.primaryCtaLabel}
      </a>
    </>
  );
}
