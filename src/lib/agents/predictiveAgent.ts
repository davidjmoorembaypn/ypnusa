/**
 * Rule-based lead scoring (fixed points, not a trained model): combines
 * rental-demand and census context for the lead's ZIP with area-level
 * life-event rates (county births, deaths and migration; state marriage
 * and divorce rates). Deterministic. scoreLead's signature is stable so a
 * trained model could replace the internals later without touching callers.
 *
 * Every input describes an AREA, never the lead. The reasons this returns
 * must stay worded that way: "the county's rate is above the national
 * rate", never a statement about the person.
 */

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  zip: string;
  tags: string[];
  lastContactAt?: string;
  createdAt: string;
}

export interface ZipContext {
  zip: string;
  county: string;
  /** 5-digit county FIPS code, when the ZIP code's county is known. */
  countyFips?: string;
  /** 2-digit state FIPS code, when the ZIP code's state is known. */
  stateFips?: string;
  /** Which inputs are real data. Absent or false means that group is a neutral placeholder, not a measurement. */
  sources?: { county: boolean; households: boolean; mobility: boolean; rentalDemand: boolean };
  census: {
    medianIncome: number;
    renterShare: number;
    ownerShare: number;
    medianAge: number;
    mobilityRate: number;
  };
  rentalDemand: {
    demandScore: number;
    vacancyRate: number;
    avgRent: number;
    trend: "up" | "flat" | "down";
  };
}

export interface CountyEvents {
  county: string;
  divorcesPerCapita: number;
  marriagesPerCapita: number;
  deathsPerCapita: number;
  probateFilings: number;
  newBirths: number;
  migrationIn: number;
  migrationOut: number;
  birthsPerCapita?: number;
  /** Net people gained through moves per resident; negative means a net loss. */
  netMigrationPerCapita?: number;
  /** The state the marriage and divorce rates describe (the Census does not publish them for counties). */
  maritalRatesFor?: string;
  /** National rates from the same sources. When present, the area is scored against them. */
  national?: { divorcesPerCapita: number; marriagesPerCapita: number; deathsPerCapita: number; birthsPerCapita: number };
  /** Which groups are real data. Probate is never available from the bundled public data. */
  available?: { countyChange: boolean; marital: boolean; probate: boolean };
}

export interface PredictiveResult {
  leadScore: number;
  lifeEventLikelihood: number;
  recommendedAction: string;
  reasons: string[];
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

/** census shares/rates arrive as fractions (0-1), e.g. 0.42 = 42%. */
function rentalMarketSignal(zipCtx: ZipContext, tags: string[], reasons: string[]): number {
  // No rental provider connected: the fields are placeholders. A placeholder vacancy of 0 must
  // not score as a tight market or be given as a reason.
  if (zipCtx.sources && !zipCtx.sources.rentalDemand) return 0;
  const { demandScore, vacancyRate, trend } = zipCtx.rentalDemand;
  let score = clampScore(demandScore) * 0.5;

  if (vacancyRate <= 0.05) {
    score += 15;
    reasons.push(`Tight rental market in ${zipCtx.zip} (vacancy ${(vacancyRate * 100).toFixed(1)}%).`);
  } else if (vacancyRate >= 0.12) {
    score -= 8;
  }

  if (trend === "up") {
    score += 12;
    reasons.push("Rental demand is trending up.");
  } else if (trend === "down") {
    score -= 8;
  }

  if (tags.includes("investor")) {
    score += 10;
    reasons.push("Lead tagged as investor — rental market signal weighted higher.");
  }

  return score;
}

function censusSignal(zipCtx: ZipContext, tags: string[], reasons: string[]): number {
  const { mobilityRate, renterShare, medianIncome } = zipCtx.census;
  let score = mobilityRate * 30;

  if (mobilityRate >= 0.2) {
    reasons.push(`High area mobility rate (${(mobilityRate * 100).toFixed(0)}%) — households are actively moving.`);
  }

  if (tags.includes("renter") || tags.includes("first-time")) {
    score += renterShare * 20;
    if (renterShare >= 0.4) {
      reasons.push(`${zipCtx.zip} has a large renter share — strong first-time-buyer pipeline.`);
    }
  }

  // Affordability heuristic: a broad middle income band converts best for first-time buyers.
  if (tags.includes("first-time") && medianIncome >= 55_000 && medianIncome <= 140_000) {
    score += 8;
  }

  return score;
}

/**
 * County vital-event rates arrive per capita (small decimals, e.g. 0.004).
 * Multiplying by 1000 approximates the conventional "per 1,000 residents"
 * scale these figures are normally reported on.
 */
/** An area counts as "above the national rate" from 15% over it, so ordinary noise does not score. */
const ABOVE_NATIONAL = 1.15;
/** Net moves per 1,000 residents in a year that count as a clear gain or loss. */
const NET_MIGRATION_PER_1000 = 5;

/**
 * Scores real area data against the national rate from the same source. Used whenever
 * `county.national` is present; the fixed thresholds below it are the older path for a
 * custom feed that supplies no baseline.
 */
function lifeEventSignalVersusNational(county: CountyEvents, zipCtx: ZipContext, reasons: string[]): number {
  const national = county.national;
  if (!national) return 0;
  const per1000 = (rate: number) => (rate * 1000).toFixed(1);
  const above = (rate: number | undefined, base: number) => rate !== undefined && base > 0 && rate / base >= ABOVE_NATIONAL;
  const maritalArea = county.maritalRatesFor ?? county.county;
  let score = 0;

  if (county.available?.marital !== false) {
    if (above(county.divorcesPerCapita, national.divorcesPerCapita)) {
      score += 12;
      reasons.push(`Divorce rate in ${maritalArea} is above the national rate (${per1000(county.divorcesPerCapita)} vs ${per1000(national.divorcesPerCapita)} per 1,000 adults; state-level figure).`);
    }
    if (above(county.marriagesPerCapita, national.marriagesPerCapita)) {
      score += 10;
      reasons.push(`Marriage rate in ${maritalArea} is above the national rate (${per1000(county.marriagesPerCapita)} vs ${per1000(national.marriagesPerCapita)} per 1,000 adults; state-level figure).`);
    }
  }

  if (county.available?.countyChange !== false) {
    if (above(county.deathsPerCapita, national.deathsPerCapita)) {
      score += 10;
      reasons.push(`Death rate in ${county.county} is above the national rate (${per1000(county.deathsPerCapita)} vs ${per1000(national.deathsPerCapita)} per 1,000 residents); inherited-home questions are more common in such areas.`);
    }
    if (above(county.birthsPerCapita, national.birthsPerCapita)) {
      score += 8;
      reasons.push(`Birth rate in ${county.county} is above the national rate (${per1000(county.birthsPerCapita ?? 0)} vs ${per1000(national.birthsPerCapita)} per 1,000 residents).`);
    }
    const netPer1000 = (county.netMigrationPerCapita ?? 0) * 1000;
    if (netPer1000 >= NET_MIGRATION_PER_1000) {
      score += 12;
      reasons.push(`${county.county} gained residents through moves last year (${netPer1000.toFixed(1)} per 1,000 residents).`);
    } else if (netPer1000 <= -NET_MIGRATION_PER_1000) {
      score += 6;
      reasons.push(`${county.county} lost residents through moves last year (${Math.abs(netPer1000).toFixed(1)} per 1,000 residents).`);
    }
  }

  if (zipCtx.census.mobilityRate >= 0.2) score += 6;

  return clampScore(score);
}

function lifeEventSignal(county: CountyEvents, zipCtx: ZipContext, reasons: string[]): number {
  if (county.national) return lifeEventSignalVersusNational(county, zipCtx, reasons);

  const per1000 = (rate: number) => rate * 1000;
  let score = 0;

  const divorceRate = per1000(county.divorcesPerCapita);
  if (divorceRate >= 3) {
    score += 22;
    reasons.push(`Elevated divorce rate in ${county.county} County (${divorceRate.toFixed(1)} per 1,000).`);
  }

  const deathRate = per1000(county.deathsPerCapita);
  if (deathRate >= 8) {
    score += 18;
    reasons.push(`Elevated mortality rate in ${county.county} County — probate/inheritance opportunity.`);
  }

  if (county.probateFilings > 0) {
    score += Math.min(county.probateFilings / 5, 20);
    reasons.push(`${county.probateFilings} active probate filing(s) in the county.`);
  }

  const marriageRate = per1000(county.marriagesPerCapita);
  if (marriageRate >= 6) {
    score += 10;
    reasons.push(`Active marriage rate in ${county.county} County — first-home purchase signal.`);
  }

  const totalMigration = county.migrationIn + county.migrationOut;
  if (totalMigration > 0) {
    const netInShare = county.migrationIn / totalMigration;
    if (netInShare >= 0.6) {
      score += 12;
      reasons.push(`Net in-migration into ${county.county} County — relocation demand.`);
    } else if (netInShare <= 0.4) {
      score += 6;
      reasons.push(`Net out-migration from ${county.county} County — sellers relocating.`);
    }
  }

  if (zipCtx.census.mobilityRate >= 0.2) score += 6;

  return clampScore(score);
}

function recommendedActionFor(tags: string[], zipCtx: ZipContext, lifeEventLikelihood: number): string {
  if (lifeEventLikelihood >= 55) return "Send life-event targeted outreach";
  if (tags.includes("investor") && zipCtx.rentalDemand.trend !== "down") return "Send investor opportunities";
  if (tags.includes("first-time") || tags.includes("renter")) return "Send first-time buyer guide";
  return "Add to standard nurture sequence";
}

export function scoreLead(lead: Lead, zipCtx: ZipContext, county: CountyEvents): PredictiveResult {
  const reasons: string[] = [];
  const tags = lead.tags.map((tag) => tag.trim().toLowerCase());

  const rentalScore = rentalMarketSignal(zipCtx, tags, reasons);
  const censusScore = censusSignal(zipCtx, tags, reasons);
  const lifeEventLikelihood = lifeEventSignal(county, zipCtx, reasons);

  const leadScore = clampScore(rentalScore * 0.4 + censusScore * 0.35 + lifeEventLikelihood * 0.25);
  const recommendedAction = recommendedActionFor(tags, zipCtx, lifeEventLikelihood);

  if (reasons.length === 0) reasons.push("No strong signals detected from ZIP code, county, or lead tags.");

  return { leadScore, lifeEventLikelihood, recommendedAction, reasons };
}
