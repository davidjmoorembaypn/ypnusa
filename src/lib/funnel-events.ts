import { track } from "@/lib/track";

/**
 * The MLO acquisition funnel, in order. These are the only funnel event names
 * the site sends to analytics, so GA4 reports and key events stay stable.
 *
 * Privacy rule: funnel events describe the loan officer's journey only. Borrower
 * data (names, emails, phones, addresses, loan details, free text) must never
 * reach analytics, so every param goes through sanitizeFunnelParams first.
 */
export const FUNNEL_EVENTS = [
  "landing_view",
  "site_preview_open",
  "signup_complete",
  "growth_profile_saved",
  "mlo_site_configured",
  "checkout_started",
  "first_payment_succeeded",
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export type FunnelParams = Record<string, string | number | boolean>;

/** Only these keys may leave the browser or server on a funnel event. */
const ALLOWED_KEYS = new Set(["source", "page_type", "path", "plan", "checkout", "step", "billing_reason"]);
const MAX_VALUE_LENGTH = 80;
/** Looks like an email, or a phone/account-length digit run: never send. */
const PERSONAL_DATA = /@|\d{7,}/;

export function isFunnelEvent(name: unknown): name is FunnelEventName {
  return typeof name === "string" && (FUNNEL_EVENTS as readonly string[]).includes(name);
}

/** Drops unknown keys and anything that could be personal data; paths lose their query and hash. */
export function sanitizeFunnelParams(params?: Record<string, unknown>): FunnelParams {
  const clean: FunnelParams = {};
  if (!params) return clean;
  for (const [key, raw] of Object.entries(params)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (typeof raw === "boolean" || (typeof raw === "number" && Number.isFinite(raw))) {
      clean[key] = raw;
      continue;
    }
    if (typeof raw !== "string") continue;
    let value = raw.trim();
    if (key === "path") value = value.split(/[?#]/)[0];
    if (!value || value.length > MAX_VALUE_LENGTH || PERSONAL_DATA.test(value)) continue;
    clean[key] = value;
  }
  return clean;
}

/** Fire a funnel event in the browser (a no-op on the server or without GA). */
export function trackFunnel(name: FunnelEventName, params?: Record<string, unknown>): void {
  track(name, sanitizeFunnelParams(params));
}

/** App areas behind sign-in, and borrower-facing MLO pages: never a "landing". */
const NON_LANDING_PREFIXES = [
  "/admin",
  "/account",
  "/analytics",
  "/api",
  "/billing",
  "/dashboard",
  "/embed",
  "/lo/",
  "/login",
  "/logout",
  "/onboarding",
  "/portal",
];

/** The page type for landing_view, or null when the path is not a public marketing page. */
export function landingPageType(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (NON_LANDING_PREFIXES.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`))) {
    return null;
  }
  if (path === "/") return "home";
  const first = path.split("/").filter(Boolean)[0] ?? "home";
  return first.length > 40 ? "page" : first;
}
