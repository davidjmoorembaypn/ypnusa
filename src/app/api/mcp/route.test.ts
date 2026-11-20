import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";

process.env.LOANPILOT_DATA_DIR = mkdtempSync(join(tmpdir(), "ypn-mcp-"));

type Handler = (request: Request) => Promise<Response>;
let POST: Handler;
let GET: Handler;
let DELETE: Handler;

const PROTOCOL = "2025-06-18";

function rpc(body: unknown, raw = false): Request {
  return new Request("https://ypnus.com/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL,
      "x-forwarded-for": "203.0.113.9",
    },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

async function call(name: string, args: Record<string, unknown>) {
  const res = await POST(rpc({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } }));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  return (await res.json()) as {
    result?: { content: { type: string; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
    error?: { code: number; message: string };
  };
}

describe("/api/mcp", () => {
  before(async () => {
    ({ POST, GET, DELETE } = (await import("./route")) as unknown as { POST: Handler; GET: Handler; DELETE: Handler });
  });

  it("answers initialize with plain JSON and no session", async () => {
    const res = await POST(
      rpc({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "test", version: "0" } },
      }),
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.equal(res.headers.get("mcp-session-id"), null);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const body = (await res.json()) as { result: { serverInfo: { name: string }; capabilities: { tools?: unknown } } };
    assert.equal(body.result.serverInfo.name, "ypnusa-mcp-server");
    assert.ok(body.result.capabilities.tools);
  });

  it("accepts the initialized notification", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", method: "notifications/initialized" }));
    assert.equal(res.status, 202);
  });

  it("lists five read-only tools whose descriptions make no lead or rate promises", async () => {
    const res = await POST(rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const body = (await res.json()) as {
      result: { tools: { name: string; description: string; annotations?: { readOnlyHint?: boolean }; inputSchema: unknown }[] };
    };
    const tools = body.result.tools;
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      "ypn_check_zip_availability",
      "ypn_describe_cerebro",
      "ypn_estimate_zip_demand",
      "ypn_find_open_nearby_zips",
      "ypn_list_plans",
    ]);
    for (const tool of tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
      assert.ok(!/guaranteed leads|lead volume|\bAPR\b|pre-?approv/i.test(tool.description), tool.name);
    }
  });

  it("checks a ZIP code and attaches the estimate disclaimer and disclosures", async () => {
    const body = await call("ypn_check_zip_availability", { zip: "93618" });
    const s = body.result!.structuredContent as {
      zip: string; available: boolean; status: string; city: string; state: string; page_url: string;
      demand: { window_days: number; disclaimer: string; total: number; buyers: number; sellers: number; movers_in: number };
    };
    assert.equal(s.zip, "93618");
    assert.equal(s.available, true);
    assert.equal(s.status, "open");
    assert.equal(s.city, "Dinuba");
    assert.equal(s.state, "CA");
    assert.match(s.page_url, /\/zip\/93618$/);
    assert.equal(s.demand.window_days, 60);
    assert.equal(s.demand.total, s.demand.buyers + s.demand.sellers + s.demand.movers_in);
    const text = body.result!.content[0].text;
    assert.match(text, /Not a lead count, a forecast or a guarantee/);
    assert.match(text, /NMLS #787257/);
    assert.match(text, /CA DRE #01852847/);
    assert.match(text, /Equal Housing Opportunity/);
  });

  it("estimates demand with its source and methodology", async () => {
    const body = await call("ypn_estimate_zip_demand", { zip: "93720" });
    const text = body.result!.content[0].text;
    assert.match(text, /U\.S\. Census Bureau/);
    assert.match(text, /not a lead guarantee/i);
  });

  it("lists open nearby ZIP codes, nearest first, within the limit", async () => {
    const body = await call("ypn_find_open_nearby_zips", { zip: "93618", limit: 3 });
    const s = body.result!.structuredContent as { neighbors: { zip: string; miles: number }[] };
    assert.equal(s.neighbors.length, 3);
    assert.ok(!s.neighbors.some((n) => n.zip === "93618"));
    assert.deepEqual([...s.neighbors].sort((a, b) => a.miles - b.miles), s.neighbors);
  });

  it("lists the four plans sold today at the public prices, without the retired Starter plan", async () => {
    const body = await call("ypn_list_plans", {});
    const s = body.result!.structuredContent as {
      plans: { name: string; price: string; monthly_price_usd: number; locks_zip_code: boolean }[];
      feature_table: { feature: string; free: string; pro: string; growth: string; exclusive: string }[];
    };
    assert.deepEqual(
      s.plans.map((p) => [p.name, p.price, p.monthly_price_usd, p.locks_zip_code]),
      [
        ["Free", "$0", 0, false],
        ["Pro", "$99", 99, true],
        ["Growth", "$199", 199, true],
        ["Exclusive", "$299", 299, true],
      ],
    );
    // Columns are named for the plan, not the storage id: the portable website starts at Growth ($199).
    const website = s.feature_table.find((row) => row.feature === "Portable MLO website")!;
    assert.deepEqual([website.free, website.pro, website.growth, website.exclusive], ["no", "no", "yes", "yes"]);
    assert.match(body.result!.content[0].text, /NMLS #787257/);
  });

  it("describes Cerebro from the /cerebro page copy, keeping unreleased features apart", async () => {
    const { CEREBRO_COMING_SOON, CEREBRO_TODAY } = await import("@/content/cerebro-capabilities");
    const body = await call("ypn_describe_cerebro", {});
    const s = body.result!.structuredContent as {
      does_today: { title: string }[]; coming_soon: { title: string }[]; never_does: string[];
    };
    assert.deepEqual(s.does_today.map((d) => d.title), CEREBRO_TODAY.map(([title]) => title));
    assert.deepEqual(s.coming_soon.map((d) => d.title), CEREBRO_COMING_SOON.map(([title]) => title));
    assert.ok(s.never_does.some((n) => /rates/i.test(n)));
    assert.match(body.result!.content[0].text, /Coming soon \(not available yet\)/);
  });

  it("rejects a malformed ZIP code and an unknown tool without a server error", async () => {
    const bad = await call("ypn_check_zip_availability", { zip: "abc" });
    assert.ok(bad.error || bad.result?.isError);
    const unknown = await call("ypn_delete_everything", {});
    assert.ok(unknown.error || unknown.result?.isError);
  });

  it("answers malformed JSON with a JSON-RPC parse error", async () => {
    const res = await POST(rpc("{not json", true));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: number } };
    assert.equal(body.error.code, -32700);
  });

  it("does not open an event stream on GET, and has no session to DELETE", async () => {
    const res = await GET(new Request("https://ypnus.com/api/mcp", { headers: { Accept: "text/event-stream" } }));
    assert.equal(res.status, 405);
    const del = await DELETE(new Request("https://ypnus.com/api/mcp", { method: "DELETE" }));
    assert.equal(del.status, 405);
  });

  it("lets any origin call the endpoint from a browser, without credentials", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");
    const preflight = proxy(
      new NextRequest("https://ypnus.com/api/mcp", {
        method: "OPTIONS",
        headers: {
          Origin: "https://claude.ai",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type, mcp-protocol-version, mcp-param-zip",
        },
      }),
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
    assert.equal(preflight.headers.get("access-control-allow-credentials"), null);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /POST/);
    assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /mcp-param-zip/);

    const post = proxy(new NextRequest("https://ypnus.com/api/mcp", { method: "POST", headers: { Origin: "https://claude.ai" } }));
    assert.equal(post.headers.get("access-control-allow-origin"), "*");
    assert.match(post.headers.get("access-control-expose-headers") ?? "", /Mcp-Session-Id/);

    // Every other API route keeps the strict allowlist.
    const other = proxy(new NextRequest("https://ypnus.com/api/leads", { method: "OPTIONS", headers: { Origin: "https://claude.ai" } }));
    assert.equal(other.status, 403);
    assert.equal(other.headers.get("access-control-allow-origin"), null);
  });
});
