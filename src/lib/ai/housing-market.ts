import type { AiToolDefinition } from "./provider";

// Labels include seasonal adjustment and annualization where they materially change interpretation.
const series: Record<string, [string, string, string, string]> = {
  MORTGAGE30US: ["30-year fixed mortgage average", "percent", "weekly", "US"],
  MORTGAGE15US: ["15-year fixed mortgage average", "percent", "weekly", "US"],
  OBMMIJUMBO30YF: ["Optimal Blue 30-year fixed jumbo mortgage index", "percent", "daily", "US"],
  SUBLPDHMDJNQ: ["Banks reporting stronger qualified jumbo mortgage demand", "net percent", "quarterly", "US"],
  SUBLPDHMDKNQ: ["Banks reporting stronger non-qualified jumbo mortgage demand", "net percent", "quarterly", "US"],
  HOUST: ["Housing starts", "thousands of units, seasonally adjusted annual rate", "monthly", "US"],
  PERMIT: ["Housing units authorized by building permits", "thousands of units, seasonally adjusted annual rate", "monthly", "US"],
  HSN1F: ["New single-family houses sold", "thousands of houses, seasonally adjusted annual rate", "monthly", "US"],
  EXHOSLUSM495S: ["Existing home sales", "units, seasonally adjusted annual rate", "monthly", "US"],
  MSACSR: ["Supply of new houses", "months, seasonally adjusted", "monthly", "US"],
  MSPUS: ["Median sale price of new houses", "USD, not seasonally adjusted", "quarterly", "US"],
  ACTLISCOUUS: ["Active listing count", "listings, not seasonally adjusted", "monthly", "US"],
  MEDDAYONMARUS: ["Median days on market", "days, not seasonally adjusted", "monthly", "US"],
  DRSFRMACBS: ["Single-family residential mortgage delinquency at commercial banks", "percent, seasonally adjusted", "quarterly", "US"],
  USSTHPI: ["FHFA all-transactions house price index", "index, not seasonally adjusted", "quarterly", "US"],
  ATNHPIUS23420Q: ["FHFA all-transactions house price index", "index, not seasonally adjusted", "quarterly", "Fresno, CA metro"],
};

const states = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");
for (const state of states) series[state + "STHPI"] = ["FHFA all-transactions house price index", "index, not seasonally adjusted", "quarterly", state];

export const HOUSING_MARKET: AiToolDefinition = {
  name: "housing_market_trend",
  description: "Fetch dated FRED housing and mortgage observations. Core series: " +
    Object.entries(series).slice(0, 16).map(([id, [title]]) => id + " " + title).join("; ") +
    ". State house price index: two-letter state plus STHPI. For other statistics or locations, search using public economic terms and select the matching series. Never send borrower details.",
  inputSchema: { type: "object", additionalProperties: false, properties: {
    seriesId: { type: "string", description: "One series identifier. Omit when searching." },
    search: { type: "string", description: "Public metric and region only, e.g. mortgage originations refinance United States." },
    asOf: { type: "string", description: "Optional YYYY-MM-DD observation cutoff. Values reflect today's revised data." },
  } },
};

type Point = { date: string; value: number };
function isoDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function observations(csv: string, id: string, end: string, frequency: string) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  if (!["observation_date," + id, "DATE," + id].includes(header)) throw new Error("Unexpected series response.");
  const rows: Point[] = [];
  for (const line of lines) {
    const [date, raw] = line.split(",");
    if (!isoDay(date) || date > end || !raw?.trim() || !Number.isFinite(Number(raw))) continue;
    rows.push({ date, value: Number(raw) });
  }
  const latest = rows.at(-1);
  if (!latest) throw new Error("No observation for the requested period.");
  const previous = rows.at(-2);
  const anniversary = Date.parse(latest.date) - 365.25 * 86400000;
  const tolerance = /daily|weekly/i.test(frequency) ? 4 : 1;
  const yearAgo = rows.reduce<Point | undefined>((best, point) => {
    const distance = Math.abs(Date.parse(point.date) - anniversary);
    if (distance > tolerance * 86400000) return best;
    return !best || distance < Math.abs(Date.parse(best.date) - anniversary) ? point : best;
  }, undefined);
  const compare = (point?: Point) => point ? { ...point, changeInSourceUnits: Number((latest.value - point.value).toPrecision(12)) } : null;
  return { latest, previousObservation: compare(previous), yearAgoObservation: compare(yearAgo) };
}

type FredSeries = { id: string; title: string; units: string; frequency: string; seasonal_adjustment: string; observation_end: string };

async function fredApi(endpoint: string, params: Record<string, string>): Promise<FredSeries[] | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  const query = new URLSearchParams({ ...params, file_type: "json", api_key: key });
  const response = await fetch("https://api.stlouisfed.org/fred/" + endpoint + "?" + query, {
    cache: "no-store", signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("FRED catalog unavailable.");
  const result = await response.json();
  return Array.isArray(result.seriess) ? result.seriess : [];
}

export async function housingMarketTrend(input: Record<string, unknown>) {
  const today = new Date().toISOString().slice(0, 10);
  const end = input.asOf ?? today;
  if (!isoDay(end) || end > today) return { error: "Supply an observation date on or before today." };
  try {
    if (typeof input.search === "string" && !input.seriesId) {
      const query = input.search.trim().slice(0, 120);
      if (!query) return { error: "Specify a metric and geography." };
      const results = await fredApi("series/search", { search_text: query, limit: "8" });
      if (!results) return { error: "Extended FRED search is not configured. Use a supported series or report the coverage gap." };
      return { matches: results.map(({ id, title, units, frequency, observation_end }) => ({ id, title, units, frequency, observation_end })) };
    }
    const id = input.seriesId;
    if (typeof id !== "string" || !/^[A-Z0-9_]{2,40}$/.test(id)) return { error: "Specify a valid series identifier or search." };
    let metadata = series[id];
    if (!metadata) {
      const rows = await fredApi("series", { series_id: id });
      const row = rows?.find((entry: { id: string }) => entry.id === id);
      if (!row) return { error: "This series is unavailable. Do not substitute another geography or metric." };
      metadata = [row.title, row.units + ", " + row.seasonal_adjustment, row.frequency, "See exact series title"];
    }
    const [title, units, frequency, geography] = metadata;
    const response = await fetch("https://fred.stlouisfed.org/graph/fredgraph.csv?id=" + id, {
      next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("Unavailable");
    const data = observations(await response.text(), id, end, frequency);
    return { id, title, units, frequency, geography, sourceUrl: "https://fred.stlouisfed.org/series/" + id,
      observationCutoff: end, checkedOn: today, ...data };
  } catch {
    return { error: "No verified observation was retrieved. Do not estimate or present a prior value as current." };
  }
}
