import { nearestZips, zipPlace, type ZipDistance } from "@/lib/geo/zip-geo";
import { zipStatusResolver, type ZipStatusInfo } from "@/lib/zip-status";

export interface OpenNeighbor {
  zip: string;
  city: string;
  state: string;
  miles: number;
}

export interface OpenNeighborsResult {
  /** Nearest open ZIP codes, nearest first. Only ZIP codes the ledger confirmed as open. */
  neighbors: OpenNeighbor[];
  /** Candidates the ledger could not answer for. They are never listed as open. */
  unknownCount: number;
  /** How many nearby ZIP codes were looked up. */
  checked: number;
}

interface Resolver {
  resolveMany: (zips: readonly string[]) => Promise<ZipStatusInfo[]>;
}

export interface FindOpenNeighborsOptions {
  limit: number;
  /** Look at no more than this many nearby ZIP codes in total. */
  maxCandidates?: number;
  maxMiles?: number;
  resolver?: Resolver;
}

const toNeighbor = (c: ZipDistance): OpenNeighbor => ({ zip: c.zip, city: c.city, state: c.state, miles: Math.round(c.miles * 10) / 10 });

/**
 * The nearest ZIP codes that are still open, by straight-line distance between ZIP code centers.
 * "Nearest" is not "bordering": a result can be several miles away. Looks up candidates in small
 * batches and stops as soon as it has `limit` open ones, so a dense city costs few lookups.
 */
export async function findOpenNeighbors(zip: string, options: FindOpenNeighborsOptions): Promise<OpenNeighborsResult> {
  const resolver = options.resolver ?? zipStatusResolver;
  const maxCandidates = options.maxCandidates ?? 40;
  const limit = Math.max(1, options.limit);
  const candidates = nearestZips(zip, maxCandidates, options.maxMiles ?? 50);

  const neighbors: OpenNeighbor[] = [];
  let unknownCount = 0;
  let checked = 0;
  const batchSize = Math.max(limit, 4);
  for (let start = 0; start < candidates.length && neighbors.length < limit; start += batchSize) {
    const batch = candidates.slice(start, start + batchSize);
    const statuses = await resolver.resolveMany(batch.map((c) => c.zip));
    checked += batch.length;
    batch.forEach((candidate, i) => {
      const status = statuses[i]?.status ?? "unknown";
      if (status === "unknown") unknownCount += 1;
      else if (status === "open" && neighbors.length < limit) neighbors.push(toNeighbor(candidate));
    });
  }
  return { neighbors, unknownCount, checked };
}

/** City and state for a ZIP code, from the geo data. Empty strings when the ZIP code is not in it. */
export function placeLabel(zip: string): { city: string; state: string } {
  const place = zipPlace(zip);
  return { city: place?.city ?? "", state: place?.state ?? "" };
}
