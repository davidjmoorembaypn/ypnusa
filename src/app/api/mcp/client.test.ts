import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

process.env.LOANPILOT_DATA_DIR = mkdtempSync(join(tmpdir(), "ypn-mcp-client-"));

/**
 * Drives /api/mcp with the real MCP client library instead of hand-written JSON-RPC, once as a
 * 2025-era client and once as a 2026-07-28 client: the route serves the two by different code paths.
 */
async function connect(mode: "legacy" | { pin: string }) {
  const route = (await import("./route")) as unknown as Record<"GET" | "POST" | "DELETE", (r: Request) => Promise<Response>>;
  const transport = new StreamableHTTPClientTransport(new URL("https://ypnus.com/api/mcp"), {
    fetch: async (input, init) => {
      const request = new Request(input as string | URL, init as RequestInit);
      return route[request.method as "GET" | "POST" | "DELETE"](request);
    },
  });
  const client = new Client({ name: "ypn-test", version: "0" }, { versionNegotiation: { mode } });
  await client.connect(transport);
  return client;
}

async function exercise(client: Client) {
  const { tools } = await client.listTools();
  assert.equal(tools.length, 5);
  const result = await client.callTool({ name: "ypn_check_zip_availability", arguments: { zip: "93618" } });
  assert.equal((result.structuredContent as { city: string }).city, "Dinuba");
  const plans = await client.callTool({ name: "ypn_list_plans", arguments: {} });
  assert.equal((plans.structuredContent as { plans: unknown[] }).plans.length, 4);
  await client.close();
}

describe("/api/mcp with the MCP client library", () => {
  it("serves a 2025-era client", async () => {
    const client = await connect("legacy");
    assert.match(client.getNegotiatedProtocolVersion() ?? "", /^2025-/);
    await exercise(client);
  });

  it("serves a 2026-07-28 client", async () => {
    const client = await connect({ pin: "2026-07-28" });
    assert.equal(client.getNegotiatedProtocolVersion(), "2026-07-28");
    await exercise(client);
  });
});
