type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: GtagParams) => void;
  }
}

/**
 * Fire a GA4 event. A silent no-op when GA is not loaded (no NEXT_PUBLIC_GA_ID,
 * blocked by CSP or an ad blocker), so callers never need to guard it.
 * Use GA4 recommended names (generate_lead, begin_checkout, ...) so they are
 * markable as key events without custom mapping.
 */
export function track(name: string, params?: GtagParams): void {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  } catch {
    /** analytics must never break the page */
  }
}
