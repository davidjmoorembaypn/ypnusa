import { areaDataScoringEnabled, countyRow, NATIONAL_RATES, stateMaritalRow } from "@/lib/area-data";
import type { CountyEvents } from "./predictiveAgent";

/**
 * Builds the CountyEvents the scoring code reads, from public data built into the app
 * (src/lib/area-data.ts): county births, deaths and net migration, and the STATE's marriage and
 * divorce rates (the Census does not publish those for counties).
 *
 * Probate filings are individual court records with no free national source, so that field is
 * always 0 and `available.probate` is false.
 *
 * Pass the ZipContext (or its county and state codes). A county name alone is not enough
 * ("Washington County" exists in 30 states), so without a code this returns the neutral
 * placeholder. The two groups are independent: a ZIP code whose county is not in the estimates
 * file (or that has no county code, as in Puerto Rico) still gets its state's marital rates.
 * `useAreaData` works as in buildZipContext.
 */

const NEUTRAL: Omit<CountyEvents, "county"> = {
  divorcesPerCapita: 0,
  marriagesPerCapita: 0,
  deathsPerCapita: 0,
  probateFilings: 0,
  newBirths: 0,
  migrationIn: 0,
  migrationOut: 0,
};

const perCapita = (events: number, base: number) => (base > 0 ? events / base : 0);
const fromPer1000 = (rate: number | null) => (rate === null ? 0 : rate / 1000);

export async function buildCountyEvents(
  county: string,
  area?: string | { countyFips?: string; stateFips?: string },
  options?: { useAreaData?: boolean },
): Promise<CountyEvents> {
  const useAreaData = options?.useAreaData ?? areaDataScoringEnabled();
  const codes = typeof area === "string" ? { countyFips: area } : (area ?? {});
  const row = useAreaData ? countyRow(codes.countyFips) : null;
  const state = useAreaData ? stateMaritalRow(codes.stateFips ?? codes.countyFips?.slice(0, 2)) : null;
  if (!row && !state) return { county, ...NEUTRAL, available: { countyChange: false, marital: false, probate: false } };

  return {
    county: row?.name ?? county,
    ...NEUTRAL,
    divorcesPerCapita: state ? perCapita(state.divorcedLastYear, state.adults15Plus) : 0,
    marriagesPerCapita: state ? perCapita(state.marriedLastYear, state.adults15Plus) : 0,
    deathsPerCapita: row ? perCapita(row.deaths, row.population) : 0,
    newBirths: row?.births ?? 0,
    birthsPerCapita: row ? perCapita(row.births, row.population) : 0,
    netMigrationPerCapita: row ? perCapita(row.netDomesticMigration + row.netInternationalMigration, row.population) : 0,
    maritalRatesFor: state?.name,
    national: {
      divorcesPerCapita: fromPer1000(NATIONAL_RATES.divorces),
      marriagesPerCapita: fromPer1000(NATIONAL_RATES.marriages),
      deathsPerCapita: fromPer1000(NATIONAL_RATES.deaths),
      birthsPerCapita: fromPer1000(NATIONAL_RATES.births),
    },
    available: { countyChange: Boolean(row), marital: Boolean(state), probate: false },
  };
}
