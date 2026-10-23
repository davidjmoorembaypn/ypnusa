"use client";

import { useState } from "react";
import { checkMarketingCompliance, type ComplianceResult, type MarketingChannelKind } from "@/lib/growth/compliance";

const CHANNELS: Array<{ value: MarketingChannelKind; label: string }> = [
  { value: "social", label: "Social post" },
  { value: "email", label: "Email" },
  { value: "sms", label: "Text message" },
  { value: "ad", label: "Ad" },
];

export function ComplianceChecker() {
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<MarketingChannelKind>("social");
  const [result, setResult] = useState<ComplianceResult | null>(null);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6" aria-labelledby="compliance-heading">
      <h2 id="compliance-heading" className="text-lg font-semibold">
        Check your copy before you post
      </h2>
      <p className="mt-1 text-sm text-white/60">
        Paste a post, email or text. This screens for common problems. It is not legal advice and does not replace
        your company&rsquo;s compliance review.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm text-white/70">
          Type{" "}
          <select
            value={channel}
            onChange={(event) => {
              setChannel(event.target.value as MarketingChannelKind);
              setResult(null);
            }}
            className="ml-1 rounded-lg border border-white/15 bg-[#0d0b26] px-3 py-1.5 text-white"
          >
            {CHANNELS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label htmlFor="compliance-text" className="sr-only">
        Marketing copy to check
      </label>
      <textarea
        id="compliance-text"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setResult(null);
        }}
        rows={7}
        placeholder="Paste your copy here…"
        className="mt-3 w-full rounded-2xl border border-white/15 bg-[#0d0b26] p-4 text-sm leading-6 text-white placeholder:text-white/35"
      />
      <button
        type="button"
        onClick={() => setResult(checkMarketingCompliance(text, channel))}
        className="mt-3 rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-[#09081b] transition hover:brightness-105"
      >
        Check my copy
      </button>

      {result && (
        <div className="mt-5 space-y-3" role="status" aria-live="polite">
          {result.findings.length === 0 ? (
            <p className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              No common problems found. Still have your compliance officer review it if your company requires that.
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">
                {result.readyForReview
                  ? "Nothing must be fixed, but some items need your judgment:"
                  : "Fix these before you use this copy:"}
              </p>
              <ul className="space-y-2">
                {result.findings.map((finding) => (
                  <li
                    key={finding.id}
                    className={`rounded-2xl border p-4 text-sm leading-6 ${
                      finding.severity === "fix"
                        ? "border-rose-400/40 bg-rose-400/10 text-rose-50"
                        : "border-amber-300/30 bg-amber-300/10 text-amber-50"
                    }`}
                  >
                    <span className="mr-2 text-xs font-bold uppercase tracking-wide">
                      {finding.severity === "fix" ? "Fix" : "Review"}
                    </span>
                    {finding.message}
                    {finding.matched && (
                      <span className="mt-1 block text-xs opacity-80">
                        Found: &ldquo;{finding.matched}&rdquo;
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
