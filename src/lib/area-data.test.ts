import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildCountyEvents } from "./agents/countyEvents";
import { scoreLead, type CountyEvents, type Lead, type ZipContext } from "./agents/predictiveAgent";
import { buildZipContext } from "./agents/zipContext";
import { areaDataScoringEnabled, areaProfile, countyRow, NATIONAL_RATES, stateMaritalRow } from "./area-data";

const lead: Lead = { id: "lead_1", name: "Sam", zip: "93618", tags: [], createdAt: "2026-11-01T00:00:00.000Z" };

describe("bundled area data", () => {
  afterEach(() => {
    delete process.env.AREA_DATA_SCORING_ENABLED;
    delete process.env.RENTAL_DEMAND_API_URL;
  });

  it("knows the county, households and rates for a ZIP code", () => {
    const dinuba = areaProfile("93618");
    assert.equal(dinuba.county?.fips, "06107");
    assert.equal(dinuba.countyName, "Tulare County");
    assert.equal(dinuba.state?.abbr, "CA");
    assert.ok(dinuba.households && Math.abs(dinuba.households.ownerShare + dinuba.households.renterShare - 1) < 1e-9);
    assert.ok(dinuba.mobilityRate !== null && dinuba.mobilityRate > 0 && dinuba.mobilityRate < 1);
    assert.deepEqual(dinuba.has, { county: true, households: true, mobility: true, countyChange: true, marital: true });
    assert.equal(areaProfile("93654").county?.name, "Fresno County");
  });

  it("keeps plausible national rates", () => {
    // Guards against a bad rebuild: US births and deaths run near 10 per 1,000 residents.
    for (const key of ["births", "deaths", "marriages", "divorces"] as const) {
      const value = NATIONAL_RATES[key];
      assert.ok(value !== null && value > 3 && value < 30, `${key} = ${value}`);
    }
    assert.ok(NATIONAL_RATES.marriages! > NATIONAL_RATES.divorces!);
    // Moves within the US cancel out; moves from abroad do not, so the national figure is not zero.
    assert.ok(NATIONAL_RATES.netMigration! > 1 && NATIONAL_RATES.netMigration! < 10, `netMigration = ${NATIONAL_RATES.netMigration}`);
  });

  it("measures mobility against people in households, and has no rate where nobody lives in one", () => {
    const dinuba = areaProfile("93618");
    // 31,659 people in households, 29,580 of them in the same house a year earlier.
    assert.ok(Math.abs(dinuba.mobilityRate! - (31659 - 29580) / 31659) < 1e-9);
    // Cornell's campus ZIP code: dormitories only, so the mobility table covers nobody.
    const campus = areaProfile("14853");
    assert.equal(campus.mobilityRate, null);
    assert.equal(campus.has.mobility, false);
  });

  it("still gives state rates when the county is unknown or not in the estimates", async () => {
    // Puerto Rico ZIP codes have no county code in the postal file.
    const sanJuan = areaProfile("00901");
    assert.equal(sanJuan.county, null);
    assert.equal(sanJuan.state?.abbr, "PR");
    assert.ok(sanJuan.rates.divorces !== null && sanJuan.rates.births === null);
    assert.deepEqual([sanJuan.has.countyChange, sanJuan.has.marital], [false, true]);

    // Yakutat, Alaska: the postal file's county code is not in the estimates file.
    const yakutat = areaProfile("99689");
    assert.equal(yakutat.county, null);
    assert.equal(yakutat.state?.abbr, "AK");
    const ctx = await buildZipContext("99689", { useAreaData: true });
    assert.equal(ctx.stateFips, "02");
    const events = await buildCountyEvents(ctx.county, ctx, { useAreaData: true });
    assert.deepEqual(events.available, { countyChange: false, marital: true, probate: false });
    assert.equal(events.maritalRatesFor, "Alaska");
    assert.ok(events.divorcesPerCapita > 0 && events.deathsPerCapita === 0);
    const scored = scoreLead({ ...lead, zip: "99689" }, ctx, events);
    assert.ok(scored.reasons.every((reason) => !/Death rate|Birth rate|residents through moves/.test(reason)));
  });

  it("covers every state and keeps names with accents intact", () => {
    assert.equal(stateMaritalRow("06")?.name, "California");
    assert.equal(stateMaritalRow("72")?.state, "PR");
    assert.equal(countyRow("35013")?.name, "Doña Ana County");
  });

  it("reports missing data as missing, never as zero", () => {
    const unknown = areaProfile("99999");
    assert.equal(unknown.county, null);
    assert.equal(unknown.households, null);
    assert.equal(unknown.mobilityRate, null);
    assert.deepEqual(unknown.rates, { births: null, deaths: null, netMigration: null, marriages: null, divorces: null });
    assert.ok(Object.values(unknown.has).every((value) => value === false));
    assert.equal(areaProfile("not-a-zip").county, null);
  });

  it("is off for stored leads unless the server setting is exactly true", () => {
    const env = (value?: string) => ({ AREA_DATA_SCORING_ENABLED: value }) as unknown as NodeJS.ProcessEnv;
    assert.equal(areaDataScoringEnabled(env()), false);
    assert.equal(areaDataScoringEnabled(env("1")), false);
    assert.equal(areaDataScoringEnabled(env(" TRUE ")), true);
  });

  it("gives stored leads the old neutral inputs while the setting is off", async () => {
    const zipContext = await buildZipContext("93618");
    assert.equal(zipContext.county, "Unknown");
    assert.equal(zipContext.countyFips, undefined);
    assert.deepEqual(zipContext.sources, { county: false, households: false, mobility: false, rentalDemand: false });
    const county = await buildCountyEvents(zipContext.county, zipContext);
    assert.equal(county.national, undefined);
    assert.equal(county.deathsPerCapita, 0);
    assert.deepEqual(county.available, { countyChange: false, marital: false, probate: false });
  });

  it("uses the real data when asked to, or when the setting is on", async () => {
    const asked = await buildZipContext("93618", { useAreaData: true });
    assert.equal(asked.county, "Tulare County");
    assert.equal(asked.countyFips, "06107");
    assert.ok(asked.census.renterShare > 0 && asked.census.mobilityRate > 0);
    assert.equal(asked.sources?.rentalDemand, false);

    process.env.AREA_DATA_SCORING_ENABLED = "true";
    const viaSetting = await buildZipContext("93618");
    assert.equal(viaSetting.countyFips, "06107");
    const county = await buildCountyEvents(viaSetting.county, viaSetting);
    assert.equal(county.county, "Tulare County");
    assert.equal(county.maritalRatesFor, "California");
    assert.ok(county.deathsPerCapita > 0.003 && county.deathsPerCapita < 0.03);
    assert.ok(county.national && county.national.birthsPerCapita > 0);
    assert.deepEqual(county.available, { countyChange: true, marital: true, probate: false });
    assert.equal(county.probateFilings, 0);
  });

  it("needs a county code, not just a name", async () => {
    const county = await buildCountyEvents("Washington County", undefined, { useAreaData: true });
    assert.equal(county.national, undefined);
    assert.equal(county.available?.countyChange, false);
  });
});

describe("scoring an area against the national rate", () => {
  const zipCtx: ZipContext = {
    zip: "00000",
    county: "Sample County",
    census: { medianIncome: 0, renterShare: 0, ownerShare: 0, medianAge: 0, mobilityRate: 0 },
    rentalDemand: { demandScore: 0, vacancyRate: 0.08, avgRent: 0, trend: "flat" },
  };
  const national = { divorcesPerCapita: 0.007, marriagesPerCapita: 0.016, deathsPerCapita: 0.009, birthsPerCapita: 0.0106 };
  const base: CountyEvents = {
    county: "Sample County",
    divorcesPerCapita: 0.007, marriagesPerCapita: 0.016, deathsPerCapita: 0.009, birthsPerCapita: 0.0106,
    netMigrationPerCapita: 0, probateFilings: 0, newBirths: 0, migrationIn: 0, migrationOut: 0,
    maritalRatesFor: "Sample State", national,
    available: { countyChange: true, marital: true, probate: false },
  };

  it("adds nothing for an area at the national rate", () => {
    const result = scoreLead(lead, zipCtx, base);
    assert.equal(result.lifeEventLikelihood, 0);
  });

  it("scores rates clearly above the national rate, and says which area each describes", () => {
    const result = scoreLead(lead, zipCtx, { ...base, birthsPerCapita: 0.014, divorcesPerCapita: 0.009, netMigrationPerCapita: 0.012 });
    assert.equal(result.lifeEventLikelihood, 8 + 12 + 12);
    assert.ok(result.reasons.some((reason) => reason.startsWith("Birth rate in Sample County is above the national rate (14.0 vs 10.6")));
    assert.ok(result.reasons.some((reason) => reason.includes("Divorce rate in Sample State") && reason.includes("state-level figure")));
    assert.ok(result.reasons.some((reason) => reason.startsWith("Sample County gained residents")));
  });

  it("ignores a rate that is only slightly above", () => {
    const result = scoreLead(lead, zipCtx, { ...base, deathsPerCapita: 0.0099 });
    assert.equal(result.lifeEventLikelihood, 0);
  });

  it("never words a reason as a statement about the lead", () => {
    const result = scoreLead(lead, zipCtx, {
      ...base, birthsPerCapita: 0.02, divorcesPerCapita: 0.02, marriagesPerCapita: 0.03, deathsPerCapita: 0.02, netMigrationPerCapita: -0.02,
    });
    for (const reason of result.reasons) {
      assert.doesNotMatch(reason, /\b(this lead|the lead|borrower|they are|is likely|likely to)\b/i, reason);
    }
  });

  it("gives no points and no reason for rental demand that is only a placeholder", () => {
    const placeholder: ZipContext = { ...zipCtx, rentalDemand: { demandScore: 0, vacancyRate: 0, avgRent: 0, trend: "flat" } };
    const unconnected = scoreLead(lead, { ...placeholder, sources: { county: true, households: true, mobility: true, rentalDemand: false } }, base);
    assert.equal(unconnected.leadScore, 0);
    assert.ok(unconnected.reasons.every((reason) => !/rental/i.test(reason)));
    // A real provider reporting a tight market still scores.
    const connected = scoreLead(lead, { ...placeholder, rentalDemand: { demandScore: 0, vacancyRate: 0.03, avgRent: 0, trend: "flat" }, sources: { county: true, households: true, mobility: true, rentalDemand: true } }, base);
    assert.ok(connected.leadScore > 0 && connected.reasons.some((reason) => /Tight rental market/.test(reason)));
  });

  it("still uses the fixed thresholds for a feed that supplies no national baseline", () => {
    const legacy: CountyEvents = { county: "Sample", divorcesPerCapita: 0.004, marriagesPerCapita: 0, deathsPerCapita: 0, probateFilings: 0, newBirths: 0, migrationIn: 0, migrationOut: 0 };
    assert.equal(scoreLead(lead, zipCtx, legacy).lifeEventLikelihood, 22);
  });

  it("scores real counties without throwing", async () => {
    for (const zip of ["93618", "33101", "06101", "99999"]) {
      const ctx = await buildZipContext(zip, { useAreaData: true });
      const county = await buildCountyEvents(ctx.county, ctx, { useAreaData: true });
      const result = scoreLead({ ...lead, zip }, ctx, county);
      assert.ok(result.lifeEventLikelihood >= 0 && result.lifeEventLikelihood <= 100);
    }
  });
});
