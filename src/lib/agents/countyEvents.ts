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
 * Pass the county's FIPS code from ZipContext.countyFips. A county name alone is not enough
 * ("Washington County" exists in 30 states), so without a code this returns the neutral
 * placeholder. `useAreaData` works as in buildZipContext.
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
  countyFips?: string,
  options?: { useAreaData?: boolean },
): Promise<CountyEvents> {
  const useAreaData = options?.useAreaData ?? areaDataScoringEnabled();
  const row = useAreaData ? countyRow(countyFips) : null;
  if (!row) return { county, ...NEUTRAL, available: { countyChange: false, marital: false, probate: false } };

  const state = stateMaritalRow(row.fips.slice(0, 2));
  return {
    county: row.name,
    ...NEUTRAL,
    divorcesPerCapita: state ? perCapita(state.divorcedLastYear, state.adults15Plus) : 0,
    marriagesPerCapita: state ? perCapita(state.marriedLastYear, state.adults15Plus) : 0,
    deathsPerCapita: perCapita(row.deaths, row.population),
    newBirths: row.births,
    birthsPerCapita: perCapita(row.births, row.population),
    netMigrationPerCapita: perCapita(row.netDomesticMigration + row.netInternationalMigration, row.population),
    maritalRatesFor: state?.name,
    national: {
      divorcesPerCapita: fromPer1000(NATIONAL_RATES.divorces),
      marriagesPerCapita: fromPer1000(NATIONAL_RATES.marriages),
      deathsPerCapita: fromPer1000(NATIONAL_RATES.deaths),
      birthsPerCapita: fromPer1000(NATIONAL_RATES.births),
    },
    available: { countyChange: true, marital: Boolean(state), probate: false },
  };
}
