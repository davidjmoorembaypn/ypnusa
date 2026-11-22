import { zipPlace } from "@/lib/geo/zip-geo";
import { hasZipDemandRow } from "@/lib/zip-demand";

/**
 * Three-digit prefixes of U.S. territories (Puerto Rico 006-009, U.S. Virgin Islands 008, Guam and
 * the Northern Mariana Islands 969) that neither bundled dataset lists completely.
 */
const TERRITORY_PREFIXES = new Set(["006", "007", "008", "009", "969"]);
/** American Samoa's single ZIP code. */
const AMERICAN_SAMOA = "96799";

/**
 * True when a five-digit code is a real U.S. ZIP code: it is in the bundled place list, in the
 * Census demand data (which covers Puerto Rico), or in a U.S. territory's range. A code that is
 * none of these (00000, a typo) can't be checked as open, sold or locked by a payment.
 */
export function isKnownZip(zip: string): boolean {
  if (!/^\d{5}$/.test(zip)) return false;
  if (zipPlace(zip)) return true;
  if (hasZipDemandRow(zip)) return true;
  return TERRITORY_PREFIXES.has(zip.slice(0, 3)) || zip === AMERICAN_SAMOA;
}
