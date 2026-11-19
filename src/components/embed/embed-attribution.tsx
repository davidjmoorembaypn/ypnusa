import { EMBED_ATTRIBUTION_CTA, EMBED_ATTRIBUTION_TEXT, brandingLine, embedAttributionUrl, type EmbedBranding } from "@/lib/embed-branding";

/**
 * Footer badge inside every embeddable widget: "Powered by Cerebro AI · Check if your ZIP code is
 * open →". It opens in a new tab so it never navigates the host site's iframe. `branding` is the
 * embedder's own company / NMLS line (already sanitized) and is rendered as plain text.
 */
export function EmbedAttribution({ tone = "dark", branding }: { tone?: "dark" | "light"; branding?: EmbedBranding }) {
  const line = branding ? brandingLine(branding) : "";
  const muted = tone === "dark" ? "text-white/60" : "text-slate-600";
  const link = tone === "dark" ? "text-violet-200 hover:text-white" : "text-violet-700 hover:text-violet-900";
  return (
    <div className={`mt-3 text-center text-[11px] leading-5 ${muted}`}>
      {line ? <p className="font-semibold">Provided by {line}</p> : null}
      <p>
        {EMBED_ATTRIBUTION_TEXT} &middot;{" "}
        <a href={embedAttributionUrl()} target="_blank" rel="noopener" className={`font-semibold underline underline-offset-2 ${link}`}>
          {EMBED_ATTRIBUTION_CTA} &rarr;
        </a>
      </p>
    </div>
  );
}
