import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  CEREBRO_COMING_SOON,
  CEREBRO_DASHBOARD,
  CEREBRO_HANDOFF_STEPS,
  CEREBRO_NEVER,
  CEREBRO_TODAY,
} from "@/content/cerebro-capabilities";
import {
  PLAN_ENTITLEMENTS,
  PUBLIC_MONTHLY_PRICE_CENTS,
  PUBLIC_PRICING_TIERS,
  type CurrentPaidTierId,
} from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { checkLedgerTerritory } from "@/lib/territory-ledger";
import {
  DEMAND_ESTIMATE_LABEL,
  DEMAND_METHODOLOGY,
  DEMAND_SOURCE,
  DEMAND_WINDOW_DAYS,
  estimateZipDemand,
} from "@/lib/zip-demand";
import { ZIP_PUBLIC_ORIGIN } from "@/lib/zip-index";
import { findOpenNeighbors } from "@/lib/zip-neighbors";

/**
 * The YPN USA MCP server: read-only tools over data the public site already shows (the ZIP code
 * checker, the ZIP market pages, /pricing and /cerebro). No leads, accounts, billing or other private data, so it needs
 * no credentials. Anything private added later must authenticate the caller first and read its
 * secret from process.env on the server.
 *
 * Mortgage compliance: nothing here quotes rates, makes a credit decision or promises leads. Demand
 * figures are Census-based estimates and every result that carries them also carries the disclaimer,
 * because an AI client repeats what a tool returns.
 */

export const MCP_SERVER_NAME = "ypnusa-mcp-server";
export const MCP_SERVER_VERSION = "1.0.0";

const DISCLOSURE =
  "YPN USA is a marketing platform for licensed loan officers, not a lender. This is not a rate quote, a credit decision or a commitment to lend. Equal Housing Opportunity. NMLS #787257. CA DRE #01852847.";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const zipInput = z
  .string()
  .regex(/^\d{5}$/, "Enter a 5-digit U.S. ZIP code, e.g. 93618.")
  .describe("5-digit U.S. ZIP code, e.g. '93618'");

const DemandSchema = z.object({
  window_days: z.number().describe("Length of the estimate window in days (60)"),
  buyers: z.number().describe("Estimated households moving into an owner-occupied home in the window"),
  sellers: z.number().describe("Assumed equal to buyers; the Census does not measure sellers"),
  movers_in: z.number().describe("Estimated households moving into a rented home in the window"),
  total: z.number().describe("buyers + sellers + movers_in"),
  population: z.number().nullable().describe("Census population of the ZIP code area; null when unknown"),
  basis: z.enum(["census_acs", "none"]).describe("'none' means no estimate is possible and every figure is 0, not measured"),
  disclaimer: z.string(),
  methodology: z.string(),
  source: z.string(),
});

type Demand = z.infer<typeof DemandSchema>;

function demandFor(zip: string): Demand | null {
  const d = estimateZipDemand(zip);
  if (!d) return null;
  return {
    window_days: d.window_days,
    buyers: d.buyers,
    sellers: d.sellers,
    movers_in: d.movers_in,
    total: d.total,
    population: d.population,
    basis: d.basis,
    disclaimer: DEMAND_ESTIMATE_LABEL,
    methodology: DEMAND_METHODOLOGY,
    source: DEMAND_SOURCE,
  };
}

function demandLines(d: Demand): string[] {
  if (d.basis === "none") {
    return ["Estimated home-buying activity: no estimate is available for this ZIP code (the Census has no usable data for it)."];
  }
  return [
    `Estimated ${d.window_days}-day home-buying activity (households): ${d.buyers} buyers, ${d.sellers} sellers (assumed equal to buyers), ${d.movers_in} renter move-ins, ${d.total} in total.`,
    d.disclaimer,
    `Source: ${d.source}.`,
  ];
}

function result<T extends Record<string, unknown>>(lines: string[], structured: T) {
  return { content: [{ type: "text" as const, text: lines.join("\n") }], structuredContent: structured };
}

function failure(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

/** A new server per request: the HTTP handler keeps no state between requests. */
export function createYpnMcpServer(): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });

  server.registerTool(
    "ypn_check_zip_availability",
    {
      title: "Check ZIP code availability",
      description: `Check whether a U.S. ZIP code is open or already exclusively held by a loan officer on YPN USA (ypnus.com).

Each ZIP code can be held by one loan officer at a time. Returns open or locked, the city and state, the public page for the ZIP code, and a Census-based estimate of home-buying activity.
The activity figures are illustrative market estimates in households. They are not lead counts, forecasts or guarantees: always repeat the disclaimer with them. This tool never returns interest rates or lending decisions.
Use ypn_find_open_nearby_zips when the ZIP code is locked and the user wants alternatives.`,
      inputSchema: z.strictObject({ zip: zipInput }),
      outputSchema: z.object({
        zip: z.string(),
        available: z.boolean().describe("true when the ZIP code is open, false when a loan officer holds it"),
        status: z.enum(["open", "locked"]),
        city: z.string().nullable(),
        state: z.string().nullable(),
        page_url: z.string().describe("Public ypnus.com page for this ZIP code"),
        demand: DemandSchema.nullable(),
        disclosure: z.string(),
      }),
      annotations: READ_ONLY,
    },
    async ({ zip }) => {
      const check = checkLedgerTerritory(zip);
      if (!check.valid) return failure("That is not a valid ZIP code. Enter 5 digits, e.g. 93618.");
      const demand = demandFor(check.zip);
      const pageUrl = `${ZIP_PUBLIC_ORIGIN}/zip/${check.zip}`;
      return result(
        [check.message, ...(demand ? demandLines(demand) : []), `Page: ${pageUrl}`, DISCLOSURE],
        {
          zip: check.zip,
          available: check.available,
          status: check.available ? ("open" as const) : ("locked" as const),
          city: check.city,
          state: check.state,
          page_url: pageUrl,
          demand,
          disclosure: DISCLOSURE,
        },
      );
    },
  );

  server.registerTool(
    "ypn_estimate_zip_demand",
    {
      title: "Estimate ZIP code home-buying activity",
      description: `Estimate ${DEMAND_WINDOW_DAYS}-day home-buying activity in a U.S. ZIP code, in households, modeled from U.S. Census Bureau survey data (population, housing tenure and mobility).

These are illustrative market estimates. They are not lead counts, forecasts or guarantees of business, and sellers are assumed equal to buyers because the Census does not measure sellers. Always repeat the disclaimer and the source with the figures.
When basis is 'none' no estimate is possible and the zeros must not be read as measured values.`,
      inputSchema: z.strictObject({ zip: zipInput }),
      outputSchema: z.object({
        zip: z.string(),
        city: z.string().nullable(),
        state: z.string().nullable(),
        demand: DemandSchema,
      }),
      annotations: READ_ONLY,
    },
    async ({ zip }) => {
      const normalized = normalizeZip(zip);
      const demand = isValidZip(normalized) ? demandFor(normalized) : null;
      if (!demand) return failure("That is not a valid ZIP code. Enter 5 digits, e.g. 93618.");
      const place = checkLedgerTerritory(normalized);
      const label = place.city && place.state ? `${place.city}, ${place.state} ${normalized}` : `ZIP code ${normalized}`;
      return result([label, ...demandLines(demand), demand.methodology], {
        zip: normalized,
        city: place.city,
        state: place.state,
        demand,
      });
    },
  );

  server.registerTool(
    "ypn_find_open_nearby_zips",
    {
      title: "Find open ZIP codes nearby",
      description: `List the nearest ZIP codes to a given ZIP code that are still open on YPN USA, nearest first.

"Nearest" is straight-line distance between ZIP code centers, within 50 miles; a result does not necessarily border the starting ZIP code. Only ZIP codes confirmed open are listed.
Use ypn_check_zip_availability to check one specific ZIP code.`,
      inputSchema: z.strictObject({
        zip: zipInput,
        limit: z.number().int().min(1).max(10).default(5).describe("How many open ZIP codes to return (1-10, default 5)"),
      }),
      outputSchema: z.object({
        zip: z.string(),
        neighbors: z.array(
          z.object({
            zip: z.string(),
            city: z.string(),
            state: z.string(),
            miles: z.number().describe("Straight-line miles between ZIP code centers"),
            page_url: z.string(),
          }),
        ),
        unknown_count: z.number().describe("Nearby ZIP codes whose status could not be confirmed; never listed as open"),
      }),
      annotations: READ_ONLY,
    },
    async ({ zip, limit }) => {
      const normalized = normalizeZip(zip);
      if (!isValidZip(normalized)) return failure("That is not a valid ZIP code. Enter 5 digits, e.g. 93618.");
      // Each call fans out to several ledger lookups. Its own shared budget, so MCP traffic can never use up the website widget's.
      if (!rateLimit("mcp-neighbors:all", 60, 60_000).ok) {
        return failure("Nearby ZIP code lookups are busy right now. Wait about 30 seconds and try again.");
      }
      const found = await findOpenNeighbors(normalized, { limit, maxCandidates: 40 });
      const neighbors = found.neighbors.map((n) => ({ ...n, page_url: `${ZIP_PUBLIC_ORIGIN}/zip/${n.zip}` }));
      const lines = neighbors.length
        ? [
            `Open ZIP codes nearest ${normalized}:`,
            ...neighbors.map((n) => `- ${n.zip} ${n.city}, ${n.state} (${n.miles} miles)`),
          ]
        : [`No open ZIP codes were found within 50 miles of ${normalized} among the ${found.checked} nearest checked.`];
      return result(lines, { zip: normalized, neighbors, unknown_count: found.unknownCount });
    },
  );

  server.registerTool(
    "ypn_list_plans",
    {
      title: "List YPN USA plans",
      description: `List the YPN USA plans a loan officer can buy today, from the same price list the /pricing page uses: Free ($0), Pro ($99/mo), Growth ($199/mo) and Exclusive ($299/mo).

Returns each plan's price, what it includes, whether it locks a ZIP code and its free-trial length, plus the feature-by-plan table. The Free plan does not lock a ZIP code; every paid plan includes one exclusive ZIP code, which locks at the first payment.
These are subscription prices for marketing software. They are not loan pricing, and no plan promises a number of leads or closed loans.`,
      inputSchema: z.strictObject({}),
      outputSchema: z.object({
        plans: z.array(
          z.object({
            name: z.string(),
            price: z.string().describe("Display price, e.g. '$99'"),
            cadence: z.string().describe("Billing cadence, e.g. '/mo'"),
            monthly_price_usd: z.number(),
            tagline: z.string(),
            features: z.array(z.string()),
            locks_zip_code: z.boolean(),
            included_zip_codes: z.string(),
            trial_days: z.number(),
          }),
        ),
        feature_table: z.array(
          z.object({ feature: z.string(), free: z.string(), pro: z.string(), growth: z.string(), exclusive: z.string() }),
        ),
        pricing_url: z.string(),
        disclosure: z.string(),
      }),
      annotations: READ_ONLY,
    },
    async () => {
      const plans = PUBLIC_PRICING_TIERS.map((tier) => ({
        name: tier.name,
        price: tier.price,
        cadence: tier.cadence,
        monthly_price_usd: tier.id === "free" ? 0 : PUBLIC_MONTHLY_PRICE_CENTS[tier.id as CurrentPaidTierId] / 100,
        tagline: tier.tagline,
        features: tier.features,
        locks_zip_code: tier.zipCapacity !== 0,
        included_zip_codes: tier.zipCapacityLabel,
        trial_days: tier.trialDays,
      }));
      // Table columns are keyed by storage id: id "growth" is the Pro plan and id "pro" is the Growth plan.
      const yesNo = (cell: string) => (cell === "✓" ? "yes" : cell === "—" ? "no" : cell);
      const featureTable = PLAN_ENTITLEMENTS.map((row) => ({
        feature: row.label,
        free: yesNo(row.free),
        pro: yesNo(row.growth),
        growth: yesNo(row.pro),
        exclusive: yesNo(row.elite),
      }));
      const pricingUrl = `${ZIP_PUBLIC_ORIGIN}/pricing`;
      const lines = [
        ...plans.map(
          (p) =>
            `${p.name}: ${p.price} ${p.cadence}. ${p.tagline}. ${p.included_zip_codes}.${p.trial_days ? ` ${p.trial_days}-day free trial.` : ""}\n` +
            p.features.map((f) => `  - ${f}`).join("\n"),
        ),
        `Details: ${pricingUrl}`,
        DISCLOSURE,
      ];
      return result(lines, { plans, feature_table: featureTable, pricing_url: pricingUrl, disclosure: DISCLOSURE });
    },
  );

  server.registerTool(
    "ypn_describe_cerebro",
    {
      title: "Describe the Cerebro assistant",
      description: `Describe Cerebro, the AI assistant YPN USA gives loan officers: what it does today, how it hands borrowers to the loan officer, what the dashboard shows, what it never does, and what is announced but not live yet.

Use this to answer "what can Cerebro do?" accurately. Present "coming_soon" items as not available yet. Cerebro never offers or locks rates, makes credit decisions or gives legal or tax advice; those stay with the licensed loan officer.`,
      inputSchema: z.strictObject({}),
      outputSchema: z.object({
        does_today: z.array(z.object({ title: z.string(), detail: z.string() })),
        handoff_steps: z.array(z.object({ title: z.string(), detail: z.string() })),
        dashboard: z.array(z.object({ title: z.string(), detail: z.string() })),
        never_does: z.array(z.string()),
        coming_soon: z.array(z.object({ title: z.string(), detail: z.string() })).describe("Announced, not available yet"),
        page_url: z.string(),
        disclosure: z.string(),
      }),
      annotations: READ_ONLY,
    },
    async () => {
      const pairs = (rows: ReadonlyArray<readonly [string, string]>) => rows.map(([title, detail]) => ({ title, detail }));
      const structured = {
        does_today: pairs(CEREBRO_TODAY),
        handoff_steps: pairs(CEREBRO_HANDOFF_STEPS),
        dashboard: pairs(CEREBRO_DASHBOARD),
        never_does: [...CEREBRO_NEVER],
        coming_soon: pairs(CEREBRO_COMING_SOON),
        page_url: `${ZIP_PUBLIC_ORIGIN}/cerebro`,
        disclosure: DISCLOSURE,
      };
      const section = (heading: string, rows: { title: string; detail: string }[]) => [
        heading,
        ...rows.map((r) => `- ${r.title}: ${r.detail}`),
      ];
      const lines = [
        ...section("What Cerebro does today:", structured.does_today),
        ...section("How it hands borrowers to the loan officer:", structured.handoff_steps),
        ...section("In the dashboard:", structured.dashboard),
        "What Cerebro never does:",
        ...structured.never_does.map((n) => `- ${n}`),
        ...section("Coming soon (not available yet):", structured.coming_soon),
        `Details: ${structured.page_url}`,
        DISCLOSURE,
      ];
      return result(lines, structured);
    },
  );

  return server;
}
