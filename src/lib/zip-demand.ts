import zlib from "node:zlib";
import { ZIP_DEMAND_GZ_BASE64, ZIP_DEMAND_VINTAGE } from "@/lib/geo/zip-demand-data.generated";

/**
 * Native 60-day ZIP code demand estimates, with no outside service.
 *
 * The response keeps the shape the retired WordPress `zip-check` endpoint returned
 * ({ window_days: 60, sellers, buyers, movers_in, total, population, source, methodology }) so
 * existing clients keep working. The NUMBERS are not a copy of that endpoint. Its code was never in
 * this repo, and its output could not be reconciled with Census data (it returned the same
 * 45 sellers / 60 buyers / 120 movers for a Montana town of 723 households and for Beverly Hills,
 * with population null). These figures are computed from real survey data instead.
 *
 * Data: U.S. Census Bureau American Community Survey (ACS) 2019-2023 5-year estimates for each
 * ZIP Code Tabulation Area: population (B01003), households by tenure (B25003) and people who moved
 * into their current home in the past year, by tenure (B07013, and B07013PR for Puerto Rico).
 *
 * A ZIP code can have population and households but no mobility table. That is "not measured", not
 * "zero moves": it gets basis "none" and is left out of every aggregate, never reported as a
 * Census-backed zero.
 *
 * Method (deterministic, the same input always gives the same output), all in HOUSEHOLDS:
 *   household size = population / households
 *   buyers    = people who moved into an owner-occupied home in the past year / household size
 *   movers_in = people who moved into a rented home in the past year / household size
 *   sellers   = buyers. The Census does not measure sellers; this ASSUMES one seller per owner
 *               move-in, which overstates sellers where many homes are newly built.
 *   each is scaled from a year to 60 days (x 60 / 365); total = buyers + sellers + movers_in.
 * buyers and movers_in never overlap, so total does not double count.
 *
 * These describe moves the Census measured. They are illustrative market estimates with sampling
 * error: never a count of leads, a forecast or a promise. Every consumer must show `methodology`
 * or DEMAND_ESTIMATE_LABEL next to the numbers.
 *
 * Server-only (the data module is ~430 KB): never import this from a client component.
 */

export const DEMAND_WINDOW_DAYS = 60;
export const DEMAND_ESTIMATE_LABEL = "Illustrative market estimate from U.S. Census Bureau survey data. Not a lead count, a forecast or a guarantee.";
export const DEMAND_SOURCE = `U.S. Census Bureau, American Community Survey ${ZIP_DEMAND_VINTAGE} 5-year estimates (tables B01003, B25003, B07013 and B07013PR); YPN USA analysis`;
export const DEMAND_METHODOLOGY =
  "60-day estimates modeled from ZCTA population, housing tenure, and mobility data (U.S. Census Bureau ACS 5-year migration patterns). Sellers are assumed equal to buyers. Illustrative demand, not a lead guarantee.";

export interface ZipDemand {
  window_days: 60;
  /** Assumed equal to buyers (the Census does not measure sellers). */
  sellers: number;
  /** Estimated households that move into an owner-occupied home in 60 days. */
  buyers: number;
  /** Estimated households that move into a rented home in 60 days. Does not include buyers. */
  movers_in: number;
  /** buyers + sellers + movers_in. */
  total: number;
  /** ACS population of the ZIP Code Tabulation Area; null when the Census has no residential data for the ZIP code. */
  population: number | null;
  source: "market_demographic_model";
  methodology: string;
  /**
   * "census_acs": estimated from survey data. "none": no estimate is possible (no residential data,
   * or no mobility data for the ZIP code), so every figure is 0 and must not be read as measured.
   */
  basis: "census_acs" | "none";
}

export interface ZipDemandSourceRow {
  population: number;
  households: number;
  /** null when the Census published no mobility data for the ZIP code (not the same as 0). */
  ownerMovers: number | null;
  allMovers: number | null;
}
type Row = ZipDemandSourceRow;

let cached: Map<string, Row> | null = null;

function load(): Map<string, Row> {
  if (cached) return cached;
  const text = zlib.gunzipSync(Buffer.from(ZIP_DEMAND_GZ_BASE64, "base64")).toString("utf8");
  const rows = new Map<string, Row>();
  for (const line of text.split("\n")) {
    const [zip, population, households, ownerMovers, allMovers] = line.split("|");
    if (!zip || !/^\d{5}$/.test(zip)) continue;
    // An empty movers field means "no mobility data"; Number("") would silently turn it into 0.
    const measured = (field: string | undefined) => (field === undefined || field.trim() === "" ? null : Number(field));
    rows.set(zip, { population: Number(population), households: Number(households), ownerMovers: measured(ownerMovers), allMovers: measured(allMovers) });
  }
  cached = rows;
  return rows;
}

const DEFAULT_HOUSEHOLD_SIZE = 2.5;
const WINDOW_SHARE_OF_YEAR = DEMAND_WINDOW_DAYS / 365;

function householdSize(row: Row): number {
  if (!(row.households > 0) || !(row.population > 0)) return DEFAULT_HOUSEHOLD_SIZE;
  // Clamp so an unusual ZIP code can't produce an absurd divisor.
  return Math.min(6, Math.max(1, row.population / row.households));
}

/** Exported for tests: the estimate for one source row. */
export function demandFromRow(row: ZipDemandSourceRow | undefined): ZipDemand {
  const shared = { window_days: 60 as const, source: "market_demographic_model" as const, methodology: DEMAND_METHODOLOGY };
  if (!row || !(row.households > 0)) return { sellers: 0, buyers: 0, movers_in: 0, total: 0, population: null, basis: "none", ...shared };
  // Population is known but mobility was never measured: report the population, estimate nothing.
  if (row.ownerMovers === null || row.allMovers === null) {
    return { sellers: 0, buyers: 0, movers_in: 0, total: 0, population: row.population, basis: "none", ...shared };
  }
  const size = householdSize(row);
  const buyers = Math.round((row.ownerMovers / size) * WINDOW_SHARE_OF_YEAR);
  const renterMovers = Math.max(0, row.allMovers - row.ownerMovers);
  const moversIn = Math.round((renterMovers / size) * WINDOW_SHARE_OF_YEAR);
  return { sellers: buyers, buyers, movers_in: moversIn, total: buyers + buyers + moversIn, population: row.population, basis: "census_acs", ...shared };
}

/**
 * 60-day demand estimate for a 5-digit ZIP code. Never null for a well-formed ZIP code: one the
 * Census has no residential data for (PO boxes, single-business ZIP codes) gets zeros with
 * basis "none" and population null, which is the truthful answer, not an invented number.
 * Returns null only when the input is not 5 digits.
 */
export function estimateZipDemand(zip: string): ZipDemand | null {
  if (!/^\d{5}$/.test(zip)) return null;
  return demandFromRow(load().get(zip));
}

/** True when the Census data lists this ZIP code at all (even with no mobility figures). */
export function hasZipDemandRow(zip: string): boolean {
  return /^\d{5}$/.test(zip) && load().has(zip);
}

export interface ZipDemandRow extends ZipDemand {
  zip: string;
  households: number;
}

/**
 * Every ZIP code with a real estimate, for aggregate reporting. ZIP codes without mobility data
 * are left out, so they can never drag a national total or a median down as fake zeros.
 */
export function allZipDemand(): ZipDemandRow[] {
  const out: ZipDemandRow[] = [];
  for (const [zip, row] of load()) {
    const demand = demandFromRow(row);
    if (demand.basis !== "census_acs") continue;
    out.push({ zip, households: row.households, ...demand });
  }
  return out;
}

export function zipDemandCoverage(): number {
  return load().size;
}

/** The raw Census row behind the estimate, or null when the ZIP code is not in the data. */
export function zipDemandSourceRow(zip: string): ZipDemandSourceRow | null {
  return /^\d{5}$/.test(zip) ? (load().get(zip) ?? null) : null;
}
