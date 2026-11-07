import { OUTBOUND_TIMEOUT_MS } from "./outbound";
import { WP_API_BASE } from "./site";
import { checkPaidLedgerTerritory, isValidZip, normalizeZip, type TerritoryCheckResult } from "./territory";

export interface LiveZipCheckResponse {
  success?: boolean;
  zip?: string;
  city?: string;
  state?: string;
  available?: boolean;
  urgency?: string;
  message?: string;
  signup_url?: string;
  demand?: {
    window_days?: number;
    total?: number;
    sellers?: number;
    buyers?: number;
    movers_in?: number;
  };
  status?: string;
  plan?: string;
}

/**
 * Ask the live WordPress territory ledger (ypnus.com) for ZIP availability.
 * Returns null when the remote API is unreachable. Production callers must
 * report unavailability rather than presenting the local demo store as live.
 */
export async function fetchLiveTerritory(
  rawZip: unknown,
): Promise<(TerritoryCheckResult & { live?: LiveZipCheckResponse }) | null> {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) {
    return {
      ok: true,
      zip,
      valid: false,
      available: false,
      totalClaimed: 0,
      message: "Enter a valid 5-digit ZIP code to check territory availability.",
    };
  }

  // Once WordPress is retired, this app's own paid ledger is the source of truth.
  if (process.env.TERRITORY_SOURCE?.trim().toLowerCase() === "local") {
    return checkPaidLedgerTerritory(zip);
  }

  const url = `${WP_API_BASE}/zip-check/${encodeURIComponent(zip)}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Territory availability should stay fresh.
      cache: "no-store",
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[live-territory] zip-check for ${zip} returned HTTP ${res.status}; live availability unavailable.`);
      return null;
    }
    const data = (await res.json()) as LiveZipCheckResponse;
    if (typeof data.available !== "boolean") {
      console.warn(
        `[live-territory] zip-check for ${zip} returned an unusable payload; live availability unavailable.`,
      );
      return null;
    }

    const place =
      data.city && data.state ? `${data.city}, ${data.state}` : `ZIP ${zip}`;

    // While WordPress still answers ZIP checks, a checkout through this app's own
    // Stripe webhook locks the ZIP only in this app's paid ledger. Honor that lock
    // too, so a ZIP sold here never shows as open (WordPress keeps supplying the
    // city and demand numbers).
    const lockedHere = data.available && !checkPaidLedgerTerritory(zip).available;
    if (lockedHere) {
      return {
        ok: true,
        zip,
        valid: true,
        available: false,
        totalClaimed: 0,
        message: `${place} is exclusively locked.`,
        live: { ...data, available: false },
      };
    }
    const demand =
      typeof data.demand?.total === "number"
        ? ` ~${data.demand.total} people buying, selling, or moving in the next ${data.demand.window_days ?? 60} days.`
        : "";

    return {
      ok: true,
      zip,
      valid: true,
      available: data.available,
      totalClaimed: 0,
      message:
        data.message?.trim() ||
        (data.available
          ? `${place} is open.${demand}`
          : `${place} is exclusively locked.${demand}`),
      live: data,
    };
  } catch (error) {
    console.warn(
      `[live-territory] zip-check for ${zip} failed; live availability unavailable.`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
