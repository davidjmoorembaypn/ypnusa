import { zipPlace, zipsWithinRadius } from "@/lib/geo/zip-geo";
import { DEMAND_ESTIMATE_LABEL, DEMAND_METHODOLOGY, DEMAND_SOURCE, estimateZipDemand } from "@/lib/zip-demand";
import { zipStatusResolver, type ZipStatus, type ZipStatusInfo } from "@/lib/zip-status";

/**
 * Multi-ZIP territory audit for branch managers: how many ZIP codes sit within a radius of an office
 * ZIP code, how many are open or claimed, and the expected buyer, seller and mover activity across
 * the open ones.
 *
 * Honest by construction: only ZIP codes the live ledger answered for count as open or claimed (the
 * rest are reported as "unknown"), activity figures are Census-based estimates (see zip-demand.ts), and a
 * hard cap keeps one request from fanning out into hundreds of lookups.
 */

export const AUDIT_RADIUS_OPTIONS = [5, 10, 15] as const;
export type AuditRadius = (typeof AUDIT_RADIUS_OPTIONS)[number];
export const DEFAULT_AUDIT_RADIUS: AuditRadius = 10;

/** Most ZIP codes looked up per audit (the office ZIP code plus the nearest others). */
export const MAX_AUDIT_ZIPS = 30;
export const MAX_OFFICERS = 50;

export interface AuditZipRow {
  zip: string;
  city: string;
  state: string;
  miles: number;
  status: ZipStatus;
  /** 60-day estimates (illustrative): buyer households, and buyers + sellers + renter move-ins. */
  buyers: number;
  total: number;
}

export interface TerritoryAudit {
  center: { zip: string; city: string; state: string };
  radiusMiles: AuditRadius;
  officers: number | null;
  totals: {
    /** Every ZIP code inside the radius, including the office ZIP code. */
    inRadius: number;
    /** How many of those were looked up (the nearest ones, capped). */
    evaluated: number;
    open: number;
    claimed: number;
    unknown: number;
    /** Inside the radius but beyond the cap, so not looked up. */
    notEvaluated: number;
  };
  /** 60-day estimates summed over the open ZIP codes. Illustrative, never a lead count. */
  demand: {
    window_days: 60;
    buyers: number;
    sellers: number;
    movers_in: number;
    total: number;
    openZips: number;
    label: string;
    source: string;
    methodology: string;
  };
  zips: AuditZipRow[];
}

export type AuditResult = { ok: true; audit: TerritoryAudit } | { ok: false; code: "INVALID_ZIP" | "UNKNOWN_ZIP"; message: string };

export function parseRadius(raw: unknown): AuditRadius {
  const n = Number(raw);
  return (AUDIT_RADIUS_OPTIONS as readonly number[]).includes(n) ? (n as AuditRadius) : DEFAULT_AUDIT_RADIUS;
}

export function parseOfficers(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_OFFICERS) : null;
}

interface Resolver {
  resolveMany: (zips: readonly string[]) => Promise<ZipStatusInfo[]>;
}

export async function runTerritoryAudit(
  input: { zip: string; radius?: unknown; officers?: unknown },
  resolver: Resolver = zipStatusResolver,
): Promise<AuditResult> {
  const zip = input.zip;
  if (!/^\d{5}$/.test(zip)) return { ok: false, code: "INVALID_ZIP", message: "Enter a 5-digit ZIP code." };
  const centerPlace = zipPlace(zip);
  if (!centerPlace) return { ok: false, code: "UNKNOWN_ZIP", message: "We don't have that ZIP code. Check it and try again." };

  const radiusMiles = parseRadius(input.radius);
  const within = zipsWithinRadius(zip, radiusMiles);
  const inRadius = within.length + 1;
  const listed = [{ ...centerPlace, miles: 0 }, ...within].slice(0, MAX_AUDIT_ZIPS);

  const statuses = await resolver.resolveMany(listed.map((p) => p.zip));
  const zips: AuditZipRow[] = listed.map((p, i) => ({
    zip: p.zip,
    city: p.city,
    state: p.state,
    miles: Math.round(p.miles * 10) / 10,
    status: statuses[i]?.status ?? "unknown",
    buyers: estimateZipDemand(p.zip)?.buyers ?? 0,
    total: estimateZipDemand(p.zip)?.total ?? 0,
  }));

  const open = zips.filter((z) => z.status === "open");
  const openDemand = open.flatMap((z) => {
    const d = estimateZipDemand(z.zip);
    return d ? [d] : [];
  });

  return {
    ok: true,
    audit: {
      center: { zip, city: centerPlace.city, state: centerPlace.state },
      radiusMiles,
      officers: parseOfficers(input.officers),
      totals: {
        inRadius,
        evaluated: zips.length,
        open: open.length,
        claimed: zips.filter((z) => z.status === "claimed").length,
        unknown: zips.filter((z) => z.status === "unknown").length,
        notEvaluated: Math.max(0, inRadius - zips.length),
      },
      demand: {
        window_days: 60,
        buyers: openDemand.reduce((sum, d) => sum + d.buyers, 0),
        sellers: openDemand.reduce((sum, d) => sum + d.sellers, 0),
        movers_in: openDemand.reduce((sum, d) => sum + d.movers_in, 0),
        total: openDemand.reduce((sum, d) => sum + d.total, 0),
        openZips: open.length,
        label: DEMAND_ESTIMATE_LABEL,
        source: DEMAND_SOURCE,
        methodology: DEMAND_METHODOLOGY,
      },
      zips,
    },
  };
}
