import dataset from "./nmdb-originations.json";
import type { AiToolDefinition } from "./provider";

export const ORIGINATIONS: AiToolDefinition = {
  name: "mortgage_origination_trend",
  description: "FHFA national quarterly estimates of loans originated and dollar volume. Compare purchase and refinance, all mortgages and jumbo. Historical published observations, with previous quarter and year-ago comparisons; not applications, locks or forecasts.",
  inputSchema: { type: "object", properties: {
    segment: { type: "string", enum: ["all","jumbo"] }, purpose: { type: "string", enum: ["all","purchase","refinance"] },
    quarter: { type: "string", description: "Optional calendar quarter such as 2025Q4. Omit for latest available." },
  }, required: ["segment","purpose"], additionalProperties: false },
};

type Originations = { countThousands?: number; volumeMillionsUSD?: number };
const records: Record<string, Record<string, Originations>> = dataset;

export function originationTrend(input: Record<string, unknown>) {
  const key = String(input.segment) + "_" + String(input.purpose);
  if (!Object.hasOwn(records, key)) return { error: "Select a valid segment and loan purpose." };
  const rows = records[key];
  const latestAvailableQuarter = Object.keys(rows).sort().at(-1)!;
  const period = input.quarter ?? latestAvailableQuarter;
  if (typeof period !== "string" || !/^\d{4}Q[1-4]$/.test(period) || !rows[period]) return { error: "No published observation for that quarter.", latestAvailableQuarter };
  const year = Number(period.slice(0, 4));
  const quarter = Number(period[5]);
  const observation = (quarterKey: string) => rows[quarterKey] ? { quarter: quarterKey, ...rows[quarterKey] } : null;
  return { source: "FHFA National Mortgage Database quarterly data", sourceUrl: "https://www.fhfa.gov/data/nmdb",
    geography: "United States", segment: input.segment, purpose: input.purpose, latestAvailableQuarter,
    observation: observation(period), previousQuarter: observation(quarter === 1 ? (year - 1) + "Q4" : year + "Q" + (quarter - 1)),
    yearAgoQuarter: observation((year - 1) + "Q" + quarter) };
}
