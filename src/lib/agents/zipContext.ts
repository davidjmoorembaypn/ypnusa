import { areaDataScoringEnabled, areaProfile } from "@/lib/area-data";
import type { ZipContext } from "./predictiveAgent";

/**
 * Builds the ZipContext the scoring code reads.
 *
 * County, owner and renter shares and the past-year mobility rate come from public data built into
 * the app (src/lib/area-data.ts): no outside service, no server setting. Household income and age
 * are not bundled and stay 0. Rental demand has no free national source; it stays a neutral
 * placeholder unless RENTAL_DEMAND_API_URL points at a provider.
 *
 * `useAreaData` decides whether the bundled figures are used. It defaults to the server setting
 * AREA_DATA_SCORING_ENABLED (off), so the automatic paths that score stored leads keep their old
 * neutral inputs until the owner switches it on. The dashboard lookup passes true. `sources` says
 * which inputs are real, so a zero is never shown as if it had been measured.
 */

const RENTAL_DEMAND_API_URL = process.env.RENTAL_DEMAND_API_URL?.trim();
const RENTAL_DEMAND_API_TOKEN = process.env.RENTAL_DEMAND_API_TOKEN?.trim();

type CensusFields = ZipContext["census"];
type RentalDemandFields = ZipContext["rentalDemand"];

const NEUTRAL_CENSUS: CensusFields = {
  medianIncome: 0,
  renterShare: 0,
  ownerShare: 0,
  medianAge: 0,
  mobilityRate: 0,
};

const NEUTRAL_RENTAL_DEMAND: RentalDemandFields = {
  demandScore: 0,
  vacancyRate: 0,
  avgRent: 0,
  trend: "flat",
};

async function fetchRentalDemandFields(zip: string): Promise<RentalDemandFields | null> {
  if (!RENTAL_DEMAND_API_URL) return null;

  try {
    const url = new URL(RENTAL_DEMAND_API_URL);
    url.searchParams.set("zip", zip);

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...(RENTAL_DEMAND_API_TOKEN ? { Authorization: `Bearer ${RENTAL_DEMAND_API_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<RentalDemandFields>;
    return { ...NEUTRAL_RENTAL_DEMAND, ...data };
  } catch {
    return null;
  }
}

export async function buildZipContext(zip: string, options?: { useAreaData?: boolean }): Promise<ZipContext> {
  const useAreaData = options?.useAreaData ?? areaDataScoringEnabled();
  const rentalDemand = await fetchRentalDemandFields(zip);
  const area = useAreaData ? areaProfile(zip) : null;

  return {
    zip,
    county: area?.countyName ?? "Unknown",
    countyFips: area?.county?.fips,
    census: area
      ? {
          ...NEUTRAL_CENSUS,
          renterShare: area.households?.renterShare ?? 0,
          ownerShare: area.households?.ownerShare ?? 0,
          mobilityRate: area.mobilityRate ?? 0,
        }
      : NEUTRAL_CENSUS,
    rentalDemand: rentalDemand ?? NEUTRAL_RENTAL_DEMAND,
    sources: {
      county: Boolean(area?.has.county),
      households: Boolean(area?.has.households),
      mobility: Boolean(area?.has.mobility),
      rentalDemand: rentalDemand !== null,
    },
  };
}
