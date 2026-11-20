import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  MAX_BATCH_ZIPS,
  MAX_CEREBRO_MESSAGE,
  askCerebro,
  cerebroChatEnabled,
  cerebroOverview,
  checkZip,
  checkZips,
  nearbyOpenZips,
  zipLockInfo,
  type CerebroDeps,
} from "./tools";

export const MCP_SERVER_NAME = "ypn-usa";
export const MCP_SERVER_VERSION = "1.0.0";

const INSTRUCTIONS = [
  "YPN USA gives each licensed mortgage loan officer one exclusive ZIP code within YPN USA, locked at the first payment on a paid plan.",
  "Use check_zip_availability (or check_zip_availability_batch) to see whether a ZIP code is open or locked, find_nearby_open_zips when it is locked, and get_zip_lock_info for how locking and plans work.",
  "Use get_cerebro_overview to explain what Cerebro does today and ask_cerebro to talk to the public-site Cerebro.",
  "Never tell a user a ZIP code is theirs until the first payment on a paid plan: a free account or a trial does not hold it.",
].join(" ");

/** Pretty JSON for the text content (what clients show a person) plus the same object as structuredContent. */
function result(data: Record<string, unknown>, isError = false): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data, ...(isError ? { isError: true } : {}) };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

export interface McpServerOptions {
  /** Who is calling (a network address), for the per-caller limits. */
  clientId: string;
  cerebro?: CerebroDeps;
}

/**
 * A fresh server per HTTP request (the endpoint is stateless: see src/lib/mcp/http.ts), with every tool
 * registered. Cheap: it only holds the tool table.
 */
export function createMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION }, { instructions: INSTRUCTIONS });

  server.registerTool(
    "check_zip_availability",
    {
      title: "Check ZIP code availability",
      description:
        "Is a 5-digit US ZIP code still open, or exclusively locked by a YPN USA loan officer? Answers from YPN USA's own paid ledger. A ZIP code is locked only by a paid plan's first payment; a free account or a trial does not hold it. Includes the city and state and an informational market estimate (never a lead count).",
      inputSchema: { zip: z.string().min(1).max(12).describe("A 5-digit US ZIP code, for example 93618.") },
      annotations: { title: "Check ZIP code availability", ...READ_ONLY },
    },
    async ({ zip }) => {
      const answer = checkZip(zip);
      return result({ ...answer }, !answer.valid);
    },
  );

  server.registerTool(
    "check_zip_availability_batch",
    {
      title: "Check several ZIP codes",
      description: `Check up to ${MAX_BATCH_ZIPS} ZIP codes at once, for example the ZIP codes of a loan officer's market. Duplicates are ignored.`,
      inputSchema: { zips: z.array(z.string().min(1).max(12)).min(1).max(50).describe(`ZIP codes to check. Only the first ${MAX_BATCH_ZIPS} distinct ones are answered.`) },
      annotations: { title: "Check several ZIP codes", ...READ_ONLY },
    },
    async ({ zips }) => {
      const { results, skipped } = checkZips(zips);
      return result({
        results,
        open: results.filter((r) => r.status === "open").map((r) => r.zip),
        locked: results.filter((r) => r.status === "locked").map((r) => r.zip),
        invalid: results.filter((r) => r.status === "invalid").map((r) => r.zip),
        skipped,
      });
    },
  );

  server.registerTool(
    "find_nearby_open_zips",
    {
      title: "Find nearby open ZIP codes",
      description:
        "The nearest ZIP codes that are still open, by straight-line distance between ZIP code centers (not 'bordering'). Use it when a ZIP code is locked. A ZIP code the ledger cannot answer for is never listed as open.",
      inputSchema: {
        zip: z.string().min(1).max(12).describe("The ZIP code to search around."),
        limit: z.number().int().min(1).max(5).optional().describe("How many open ZIP codes to return (1 to 5, default 3)."),
      },
      annotations: { title: "Find nearby open ZIP codes", ...READ_ONLY },
    },
    async ({ zip, limit }) => {
      const nearby = await nearbyOpenZips(zip, limit ?? 3);
      return result({ ...nearby }, !nearby.valid);
    },
  );

  server.registerTool(
    "get_zip_lock_info",
    {
      title: "How ZIP code locking and plans work",
      description: "How an exclusive ZIP code is locked, what each public plan costs and includes, and where to check a ZIP code or start.",
      annotations: { title: "How ZIP code locking and plans work", ...READ_ONLY },
    },
    async () => result({ ...zipLockInfo() }),
  );

  server.registerTool(
    "get_cerebro_overview",
    {
      title: "What Cerebro does",
      description:
        "What Cerebro, YPN USA's AI assistant for loan officers and borrowers, does today, what it does not do yet, and how it handles follow-up messages.",
      annotations: { title: "What Cerebro does", ...READ_ONLY },
    },
    async () => result({ ...cerebroOverview() }),
  );

  if (cerebroChatEnabled()) {
    server.registerTool(
      "ask_cerebro",
      {
        title: "Ask Cerebro",
        description:
          "Send one message to the public-site Cerebro, the same assistant visitors talk to on ypnus.com, and get its reply. Pass the returned sessionId on the next call to continue the conversation. This is the public assistant: it does not see or change any loan officer's own leads, drafts or settings. Limited per caller and overall.",
        inputSchema: {
          message: z.string().min(1).max(MAX_CEREBRO_MESSAGE).describe("What to say to Cerebro."),
          sessionId: z.string().min(1).max(160).optional().describe("The sessionId from an earlier reply, to continue that conversation."),
        },
        annotations: { title: "Ask Cerebro", readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ message, sessionId }) => {
        try {
          const reply = await askCerebro({ message, sessionId }, options.clientId, options.cerebro);
          return reply.ok ? result({ ...reply }) : result({ error: reply.error }, true);
        } catch {
          return result({ error: "Cerebro is temporarily unavailable. Please try again." }, true);
        }
      },
    );
  }

  return server;
}
