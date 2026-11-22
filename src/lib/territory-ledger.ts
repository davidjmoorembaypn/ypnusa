import { isKnownZip, zipPlace } from "@/lib/geo/zip-geo";
import { checkPaidLedgerTerritory, type TerritoryCheckResult } from "@/lib/territory";

/**
 * ZIP code availability from this app's own paid ledger: the single source of truth.
 *
 * A ZIP code is claimed when a live paid subscription holds it (see checkPaidLedgerTerritory).
 * There is no external lookup: WordPress is retired, so nothing here makes a network call and the
 * answer can't be "temporarily unavailable". City and state come from the bundled ZIP data.
 */

export interface LedgerTerritoryResult extends TerritoryCheckResult {
  /** null when the check is not valid; a ZIP code missing from the bundled ZIP data is not valid. */
  city: string | null;
  state: string | null;
}

export function checkLedgerTerritory(rawZip: unknown): LedgerTerritoryResult {
  const result = checkPaidLedgerTerritory(rawZip);
  if (!result.valid) return { ...result, city: null, state: null };
  // Five digits but not a U.S. ZIP code (00000, a typo): never shown as open, so it can't be paid for.
  if (!isKnownZip(result.zip)) {
    return {
      ...result,
      valid: false,
      available: false,
      city: null,
      state: null,
      message: `${result.zip} isn't a U.S. ZIP code we recognize. Check the five digits and try again.`,
    };
  }
  const place = zipPlace(result.zip);
  const city = place?.city || null;
  const state = place?.state || null;
  const label = city && state ? `${city}, ${state}` : `ZIP code ${result.zip}`;
  return {
    ...result,
    city,
    state,
    message: result.available ? `${label} is open.` : `${label} is exclusively locked.`,
  };
}
