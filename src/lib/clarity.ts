import { landingPageType } from "@/lib/funnel-events";

/** Microsoft Clarity project IDs are short lowercase letters and digits (e.g. "x214y1lr5s"). */
export function normalizeClarityId(raw: string | undefined | null): string | null {
  const id = raw?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{6,20}$/.test(id) ? id : null;
}

/**
 * Clarity records only public marketing pages. App screens behind sign-in, admin, billing,
 * the Cerebro embed and borrower-facing MLO pages (/lo/...) show borrower and customer data,
 * so they are never recorded. Same list as the landing_view funnel event.
 */
export function shouldRecordWithClarity(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return landingPageType(pathname) !== null;
}

/** The URL of the Clarity tag for a project. */
export function clarityTagUrl(id: string): string {
  return `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
}
