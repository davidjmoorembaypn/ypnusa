import { isValidZip, normalizeZip } from "@/lib/territory";
import { checkLedgerTerritory } from "@/lib/territory-ledger";

/**
 * One place to ask "is this ZIP code open, claimed, or can't we tell?".
 *
 * The answer comes from this app's own paid ledger, the single source of truth, so a valid ZIP code
 * is always open or claimed. "unknown" remains for a malformed ZIP code or a failed lookup, and is
 * never treated as open.
 */

export type ZipStatus = "open" | "claimed" | "unknown";

export interface ZipStatusInfo {
  zip: string;
  status: ZipStatus;
  /** "ledger" = this app's paid ledger answered; "none" = no answer (status is "unknown"). */
  source: "ledger" | "none";
}

export interface LiveZipAnswer {
  available: boolean;
}

export interface ZipStatusDeps {
  /** Resolves the ledger's answer, or null when it can't be had. */
  live: (zip: string) => Promise<LiveZipAnswer | null>;
  now?: () => number;
  ttlMs?: number;
  unknownTtlMs?: number;
  concurrency?: number;
}

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_UNKNOWN_TTL_MS = 30_000;
const DEFAULT_CONCURRENCY = 6;

export function createZipStatusResolver(deps: ZipStatusDeps) {
  const now = deps.now ?? Date.now;
  const ttl = deps.ttlMs ?? DEFAULT_TTL_MS;
  const unknownTtl = deps.unknownTtlMs ?? DEFAULT_UNKNOWN_TTL_MS;
  const concurrency = Math.max(1, deps.concurrency ?? DEFAULT_CONCURRENCY);
  const cache = new Map<string, { at: number; ttl: number; info: ZipStatusInfo }>();
  const inflight = new Map<string, Promise<ZipStatusInfo>>();

  async function lookup(zip: string): Promise<ZipStatusInfo> {
    const unknown: ZipStatusInfo = { zip, status: "unknown", source: "none" };
    if (!isValidZip(zip)) return unknown;
    try {
      const live = await deps.live(zip);
      if (live) {
        return {
          zip,
          status: live.available ? "open" : "claimed",
          source: "ledger",
        };
      }
    } catch {
      /* a failed lookup is "unknown", never "open" */
    }
    return unknown;
  }

  function resolve(rawZip: string): Promise<ZipStatusInfo> {
    const zip = normalizeZip(rawZip);
    const hit = cache.get(zip);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.info);
    const pending = inflight.get(zip);
    if (pending) return pending;
    const promise = lookup(zip)
      .then((info) => {
        cache.set(zip, { at: now(), ttl: info.status === "unknown" ? unknownTtl : ttl, info });
        if (cache.size > 5000) for (const [key, value] of cache) if (now() - value.at >= value.ttl) cache.delete(key);
        return info;
      })
      .finally(() => inflight.delete(zip));
    inflight.set(zip, promise);
    return promise;
  }

  /** Resolves many ZIP codes with at most `concurrency` lookups in flight; result order matches input. */
  async function resolveMany(zips: readonly string[]): Promise<ZipStatusInfo[]> {
    const results: ZipStatusInfo[] = new Array(zips.length);
    let next = 0;
    async function worker() {
      while (next < zips.length) {
        const i = next++;
        results[i] = await resolve(zips[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, zips.length) }, worker));
    return results;
  }

  function clear() {
    cache.clear();
  }

  return { resolve, resolveMany, clear };
}

/** The app-wide resolver, answering from this app's paid ledger. No network calls. */
export const zipStatusResolver = createZipStatusResolver({
  live: async (zip) => {
    const result = checkLedgerTerritory(zip);
    return result.valid ? { available: result.available } : null;
  },
  // The ledger is in memory, so keep answers fresh rather than cached for minutes.
  ttlMs: 5_000,
  unknownTtlMs: 0,
});
