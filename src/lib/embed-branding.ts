import { MARKETING_SITE_URL } from "@/lib/site";

/**
 * Helpers for the embeddable tools: the "Powered by Cerebro AI" attribution link, the optional
 * company / NMLS line an embedder can add, and the copy-paste snippet that carries both.
 *
 * Embedders type their own company and NMLS number, so both are treated as untrusted text: they are
 * validated here, rendered only as text, and escaped again when written into the snippet.
 */

export const EMBED_ATTRIBUTION_TEXT = "Powered by Cerebro AI";
export const EMBED_ATTRIBUTION_CTA = "Check if your ZIP code is open";

/** The free, no-login ZIP availability checker, tagged so embed traffic is measurable. */
export function embedAttributionUrl(origin: string = MARKETING_SITE_URL): string {
  return `${origin}/check-zip?utm_source=embed_widget&utm_medium=referral&utm_campaign=free_tools`;
}

export interface EmbedBranding {
  company?: string;
  nmls?: string;
}

const MAX_COMPANY_LENGTH = 60;
const MAX_NMLS_LENGTH = 10;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Company: letters, digits, spaces and . , ' & - only, up to 60 characters. NMLS: digits only, up to
 * 10. Anything else is dropped, never repaired into something that looks valid.
 */
export function sanitizeEmbedBranding(input: { company?: string | string[]; nmls?: string | string[] }): EmbedBranding {
  const company = first(input.company)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} .,'&-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_COMPANY_LENGTH)
    .trim();
  const nmlsDigits = first(input.nmls).replace(/\D/g, "").slice(0, MAX_NMLS_LENGTH);
  return { ...(company ? { company } : {}), ...(nmlsDigits ? { nmls: nmlsDigits } : {}) };
}

export function brandingLine(branding: EmbedBranding): string {
  const parts: string[] = [];
  if (branding.company) parts.push(branding.company);
  if (branding.nmls) parts.push(`NMLS #${branding.nmls}`);
  return parts.join(" · ");
}

export function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
}

export interface EmbedSnippetInput {
  origin: string;
  path: string;
  height: number;
  title: string;
  /** Optional company / NMLS line, shown in the widget footer. Only passed for the calculator. */
  branding?: EmbedBranding;
  /** Backlink under the widget. */
  creditPath: string;
  creditText: string;
}

export function buildEmbedSnippet(input: EmbedSnippetInput): string {
  const branding = sanitizeEmbedBranding(input.branding ?? {});
  const query = new URLSearchParams();
  if (branding.company) query.set("company", branding.company);
  if (branding.nmls) query.set("nmls", branding.nmls);
  const qs = query.toString();
  const src = `${input.origin}${input.path}${qs ? `?${qs}` : ""}`;
  return `<iframe src="${escapeHtmlAttr(src)}" title="${escapeHtmlAttr(input.title)}" width="100%" height="${Math.round(input.height)}" style="border:0;max-width:640px" loading="lazy"></iframe>
<p style="font-size:12px"><a href="${escapeHtmlAttr(`${input.origin}${input.creditPath}`)}">${escapeHtmlAttr(input.creditText)}</a></p>`;
}
