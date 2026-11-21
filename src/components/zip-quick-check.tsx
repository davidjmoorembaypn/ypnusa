"use client";

import { track } from "@/lib/track";
import { ZipInput } from "@/components/zip-input";

/**
 * One-field ZIP code check that hands off to /claim-territory?zip=…, where the full check
 * runs automatically. A plain GET form, so it works before hydration and without JS.
 */
export function ZipQuickCheck({ source, tone = "light" }: { source: string; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <form
      action="/claim-territory"
      method="get"
      className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
      onSubmit={(event) => {
        const zip = new FormData(event.currentTarget).get("zip");
        track("next_step_click", { source, cta: "zip_quick_check", zip: typeof zip === "string" ? zip : undefined });
      }}
    >
      <label className="sr-only" htmlFor={`zip-quick-${source}`}>
        Your ZIP code
      </label>
      <ZipInput
        id={`zip-quick-${source}`}
        name="zip"
        required
        placeholder="Your ZIP code"
        className={`min-h-[48px] flex-1 rounded-full border px-5 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${dark ? "border-white/25 bg-white/10 text-white placeholder:text-white/60" : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-500"}`}
      />
      <button
        type="submit"
        className="min-h-[48px] rounded-full bg-amber-400 px-6 text-sm font-semibold text-[#09081b] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        Check my ZIP code
      </button>
    </form>
  );
}
