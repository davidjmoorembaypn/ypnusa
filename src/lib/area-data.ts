import zlib from "node:zlib";
import {
  AREA_ACS_VINTAGE,
  AREA_COUNTY_GZ_BASE64,
  AREA_ESTIMATES_PERIOD,
  AREA_ESTIMATES_VINTAGE,
  AREA_NATIONAL,
  AREA_STATE_GZ_BASE64,
  AREA_ZIP_GZ_BASE64,
} from "@/lib/geo/area-data.generated";
import { zipToState } from "@/lib/compliance/zip-state";

/**
 * Area-level public data for a ZIP code: the county it is in, how its households split between
 * owning and renting, how many residents moved in the past year, the county's births, deaths and
 * migration, and the state's marriage and divorce rates. Built into the app from public files
 * (scripts/build-area-data.mjs), so it needs no outside service and no server setting.
 *
 * Everything here describes an AREA. Nothing identifies a person or a household, and nothing says
 * that any one resident married, divorced, had a child, moved or died. Callers must word it that
 * way too: "the county's birth rate is above the national rate", never "this person is likely to".
 *
 * What is NOT here, because no free public source covers the country:
 *  - probate, divorce or deed filings (individual court and recorder records);
 *  - marriage and divorce rates below state level;
 *  - rental demand, vacancy or rents; household income and age (not bundled).
 *
 * Server-only (the data module is ~700 KB): never import this from a client component.
 */

export const AREA_SOURCES = {
  county: "GeoNames US postal code file (CC BY 4.0)",
  households: `U.S. Census Bureau, American Community Survey ${AREA_ACS_VINTAGE} 5-year estimates (tables B25003 and B07013)`,
  marital: `U.S. Census Bureau, American Community Survey ${AREA_ACS_VINTAGE} 5-year estimates (tables B12501 and B12503); published for states, not counties`,
  countyChange: `U.S. Census Bureau, Population Estimates Program, Vintage ${AREA_ESTIMATES_VINTAGE} (${AREA_ESTIMATES_PERIOD})`,
} as const;

export const AREA_DATA_LABEL =
  "Area-level public statistics with sampling error. They describe a county or state, not any person, and are not a lead count, a forecast or a guarantee.";

export interface ZipAreaRow {
  countyFips: string | null;
  countyName: string | null;
  /** null when the Census published no housing data for the ZIP code (not the same as 0). */
  ownerHouseholds: number | null;
  renterHouseholds: number | null;
  /** People aged 1 and over living in households (group quarters are not in the mobility table). */
  peopleInHouseholds: number | null;
  /** Of those, how many moved into their current home in the past year. */
  movedInPastYear: number | null;
}

export interface CountyRow {
  fips: string;
  name: string;
  state: string;
  population: number;
  births: number;
  deaths: number;
  /** People moving in from elsewhere in the US minus people moving out; negative means a net loss. */
  netDomesticMigration: number;
  netInternationalMigration: number;
}

export interface StateMaritalRow {
  fips: string;
  state: string;
  name: string;
  adults15Plus: number;
  divorcedLastYear: number;
  marriedLastYear: number;
}

interface Index {
  zips: Map<string, ZipAreaRow>;
  counties: Map<string, CountyRow>;
  states: Map<string, StateMaritalRow>;
  statesByAbbr: Map<string, StateMaritalRow>;
}

let cached: Index | null = null;

const lines = (gz: string) => zlib.gunzipSync(Buffer.from(gz, "base64")).toString("utf8").split("\n");
/** An empty field means "not published"; Number("") would silently turn it into 0. */
const measured = (field: string | undefined) => (field === undefined || field.trim() === "" ? null : Number(field));

function load(): Index {
  if (cached) return cached;
  const zips = new Map<string, ZipAreaRow>();
  for (const line of lines(AREA_ZIP_GZ_BASE64)) {
    const [zip, fips, name, owner, renter, inHouseholds, movers] = line.split("|");
    if (!zip || !/^\d{5}$/.test(zip)) continue;
    zips.set(zip, {
      countyFips: fips || null, countyName: name || null,
      ownerHouseholds: measured(owner), renterHouseholds: measured(renter),
      peopleInHouseholds: measured(inHouseholds), movedInPastYear: measured(movers),
    });
  }
  const counties = new Map<string, CountyRow>();
  for (const line of lines(AREA_COUNTY_GZ_BASE64)) {
    const [fips, name, state, population, births, deaths, domestic, international] = line.split("|");
    if (!fips || !/^\d{5}$/.test(fips)) continue;
    counties.set(fips, {
      fips, name, state,
      population: Number(population), births: Number(births), deaths: Number(deaths),
      netDomesticMigration: Number(domestic), netInternationalMigration: Number(international),
    });
  }
  const states = new Map<string, StateMaritalRow>();
  for (const line of lines(AREA_STATE_GZ_BASE64)) {
    const [fips, state, name, adults, divorced, married] = line.split("|");
    if (!fips || !/^\d{2}$/.test(fips)) continue;
    states.set(fips, { fips, state, name, adults15Plus: Number(adults), divorcedLastYear: Number(divorced), marriedLastYear: Number(married) });
  }
  const statesByAbbr = new Map([...states.values()].map((row) => [row.state, row]));
  cached = { zips, counties, states, statesByAbbr };
  return cached;
}

export function zipAreaRow(zip: string): ZipAreaRow | null {
  return /^\d{5}$/.test(zip) ? (load().zips.get(zip) ?? null) : null;
}

export function countyRow(fips: string | null | undefined): CountyRow | null {
  return fips ? (load().counties.get(fips) ?? null) : null;
}

export function stateMaritalRow(stateFips: string | null | undefined): StateMaritalRow | null {
  return stateFips ? (load().states.get(stateFips) ?? null) : null;
}

/**
 * The state a ZIP code is in: from its county code when the postal file has one, otherwise from
 * the ZIP code's prefix. Puerto Rico ZIP codes and ZIP codes in a county the estimates file does
 * not list still get their state's marriage and divorce rates this way.
 */
export function stateForZip(zip: string): StateMaritalRow | null {
  if (!/^\d{5}$/.test(zip)) return null;
  const index = load();
  const row = index.zips.get(zip);
  // A ZIP code that is in none of the source files gets nothing, not a guess from its prefix.
  if (!row) return null;
  const fromCounty = index.states.get(row.countyFips?.slice(0, 2) ?? "");
  if (fromCounty) return fromCounty;
  const abbr = zipToState(zip);
  return abbr ? (index.statesByAbbr.get(abbr) ?? null) : null;
}

/** Events per 1,000 people. null when the base is missing or zero, so a rate is never invented. */
function per1000(events: number | null | undefined, base: number | null | undefined): number | null {
  if (events === null || events === undefined || !base || !(base > 0)) return null;
  return (events / base) * 1000;
}

export interface AreaRates {
  /** Per 1,000 residents, over the estimates year. */
  births: number | null;
  deaths: number | null;
  /**
   * Net people gained (or lost, when negative) through moves, per 1,000 residents: moves within
   * the US plus moves to and from abroad.
   */
  netMigration: number | null;
  /** Per 1,000 people aged 15 and over, in the year before the survey. State level. */
  marriages: number | null;
  divorces: number | null;
}

export const NATIONAL_RATES: AreaRates = {
  births: per1000(AREA_NATIONAL.births, AREA_NATIONAL.population),
  deaths: per1000(AREA_NATIONAL.deaths, AREA_NATIONAL.population),
  // Moves within the US cancel out across the country; moves to and from abroad do not, so the
  // national figure is the net international gain. Same two components as a county's figure.
  netMigration: per1000(AREA_NATIONAL.netInternationalMigration, AREA_NATIONAL.population),
  marriages: per1000(AREA_NATIONAL.marriedLastYear, AREA_NATIONAL.adults15Plus),
  divorces: per1000(AREA_NATIONAL.divorcedLastYear, AREA_NATIONAL.adults15Plus),
};

export interface AreaProfile {
  zip: string;
  county: { fips: string; name: string; state: string; population: number } | null;
  /** The county code from the postal file, even when the estimates file has no such county. */
  postalCountyFips: string | null;
  /** County name from the postal file when the county is not in the estimates file. */
  countyName: string | null;
  state: { abbr: string; name: string; fips: string } | null;
  households: { owner: number; renter: number; ownerShare: number; renterShare: number } | null;
  /** Share of people living in households who moved into their current home in the past year, 0 to 1. */
  mobilityRate: number | null;
  rates: AreaRates;
  national: AreaRates;
  /** Which groups of figures are present for this ZIP code. */
  has: { county: boolean; households: boolean; mobility: boolean; countyChange: boolean; marital: boolean };
}

/**
 * Everything known about the area around a ZIP code. Never throws; a ZIP code with no data comes
 * back with nulls and every `has` flag false, which callers must show as "no data", not as zero.
 */
export function areaProfile(zip: string): AreaProfile {
  const row = zipAreaRow(zip);
  const county = countyRow(row?.countyFips);
  const state = stateForZip(zip);

  const owner = row?.ownerHouseholds ?? null;
  const renter = row?.renterHouseholds ?? null;
  const occupied = owner !== null && renter !== null ? owner + renter : 0;
  const households = owner !== null && renter !== null && occupied > 0
    ? { owner, renter, ownerShare: owner / occupied, renterShare: renter / occupied }
    : null;

  // Movers over the people the mobility table covers (those living in households). A ZIP code
  // with nobody in households, such as a campus of dormitories, has no rate, not a rate of zero.
  const inHouseholds = row?.peopleInHouseholds ?? null;
  const movers = row?.movedInPastYear ?? null;
  const mobilityRate = inHouseholds !== null && movers !== null && inHouseholds > 0 ? Math.min(1, movers / inHouseholds) : null;

  const rates: AreaRates = {
    births: per1000(county?.births, county?.population),
    deaths: per1000(county?.deaths, county?.population),
    netMigration: county ? per1000(county.netDomesticMigration + county.netInternationalMigration, county.population) : null,
    marriages: per1000(state?.marriedLastYear, state?.adults15Plus),
    divorces: per1000(state?.divorcedLastYear, state?.adults15Plus),
  };

  return {
    zip,
    county: county ? { fips: county.fips, name: county.name, state: county.state, population: county.population } : null,
    postalCountyFips: row?.countyFips ?? null,
    countyName: county?.name ?? row?.countyName ?? null,
    state: state ? { abbr: state.state, name: state.name, fips: state.fips } : null,
    households,
    mobilityRate,
    rates,
    national: NATIONAL_RATES,
    has: {
      county: Boolean(county?.name ?? row?.countyName),
      households: households !== null,
      mobility: mobilityRate !== null,
      countyChange: rates.births !== null,
      marital: rates.divorces !== null,
    },
  };
}

/**
 * Whether stored leads are scored with this data. Off unless the server sets
 * AREA_DATA_SCORING_ENABLED=true: switching it on changes how every new lead is scored, which
 * feeds follow-up urgency, so it is a decision for the owner and not a default. The dashboard
 * lookup shows the data either way.
 */
export function areaDataScoringEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AREA_DATA_SCORING_ENABLED?.trim().toLowerCase() === "true";
}
