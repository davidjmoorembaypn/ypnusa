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
      <span className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-100">
        {copy.eyebrow}
      </span>
      <a
        href={copy.primaryCtaHref}
        className="inline-flex items-center justify-center rounded-full bg-amber-400 px-7 py-3.5 text-sm font-semibold text-[#09081b] shadow-xl shadow-amber-500/30 transition duration-200 hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
      >
        {copy.primaryCtaLabel}
      </a>
    </>
  );
}
