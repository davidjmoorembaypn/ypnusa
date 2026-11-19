import { FLAGSHIP_ZIPS, flagshipZip } from "@/content/zip-flagship";
import { nearestZips, zipPlace, type ZipDistance } from "@/lib/geo/zip-geo";
import { LOCAL_SEO_PROFILES } from "@/lib/local-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { paidLedgerClaimedZips } from "@/lib/territory";

/**
 * The single indexation gate for /zip/<zip> pages. Metadata robots, the sitemap and internal
 * neighbor links all ask here, so they can never disagree.
 *
 * A ZIP code page is indexable only when the ZIP code is:
 *   (a) actively claimed by a paying loan officer in this app's ledger, or
 *   (b) one of the 15 flagship ZIP codes (src/content/zip-flagship.ts), or
 *   (c) one with a hand-written local profile (src/lib/local-seo.ts), which were indexable before
 *       this gate existed and stay that way.
 * Everything else renders "noindex, follow", stays out of the sitemap and is never linked from
 * another ZIP code page, so crawlers are not led through thousands of thin pages.
 */

export type ZipIndexReason = "claimed" | "flagship" | "profile";

const HANDWRITTEN_ZIPS = new Set(LOCAL_SEO_PROFILES.filter((p) => p.kind === "zip").map((p) => p.slug));

export function zipIndexReason(zip: string, claimed: ReadonlySet<string> = paidLedgerClaimedZips()): ZipIndexReason | null {
  if (!/^\d{5}$/.test(zip) || !zipPlace(zip)) return null;
  if (claimed.has(zip)) return "claimed";
  if (flagshipZip(zip)) return "flagship";
  if (HANDWRITTEN_ZIPS.has(zip)) return "profile";
  return null;
}

export function isZipIndexable(zip: string, claimed?: ReadonlySet<string>): boolean {
  return zipIndexReason(zip, claimed) !== null;
}

/** Every indexable ZIP code, sorted. This is exactly the set of /zip pages in the sitemap. */
export function indexableZips(claimed: ReadonlySet<string> = paidLedgerClaimedZips()): string[] {
  const all = new Set<string>([...FLAGSHIP_ZIPS.map((z) => z.zip), ...HANDWRITTEN_ZIPS, ...claimed]);
  return [...all].filter((zip) => zipIndexReason(zip, claimed) !== null).sort();
}

/** Self-referencing canonical: no query string, no UTM tags. */
export function zipCanonicalUrl(zip: string, origin: string = MARKETING_SITE_URL): string {
  return `${origin}/zip/${zip}`;
}

const NEIGHBOR_RADIUS_MILES = 60;

/**
 * The nearest ZIP codes whose pages are indexable, nearest first. Non-indexable neighbors are
 * left out on purpose, so no indexable page links to a noindex one.
 */
export function nearestIndexableZips(zip: string, limit = 5, claimed: ReadonlySet<string> = paidLedgerClaimedZips()): ZipDistance[] {
  // No candidate cap: a dense metro has far more than a few hundred ZIP codes inside 60 miles, and a
  // cap applied before the indexability filter would hide an indexable ZIP code that sits beyond it.
  return nearestZips(zip, Number.POSITIVE_INFINITY, NEIGHBOR_RADIUS_MILES)
    .filter((candidate) => zipIndexReason(candidate.zip, claimed) !== null)
    .slice(0, limit);
}
