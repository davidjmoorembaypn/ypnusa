import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { RevenueSubscriptionRecord } from "@/lib/types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-mcp-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function paidSub(zip: string): RevenueSubscriptionRecord {
  return {
    id: `sub_${zip}`,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    stripeSubscriptionId: `stripe_${zip}`,
    stripeCustomerId: `cus_${zip}`,
    claimedZips: [zip],
  };
}

const URL_MCP = "https://ypnus.com/api/mcp";
const JSON_HEADERS = { "content-type": "application/json", accept: "application/json, text/event-stream" };
const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } },
};

describe("MCP endpoint", async () => {
  const { handleMcpRequest, originAllowed } = await import("./http");
  const tools = await import("./tools");
  const { POST, GET, DELETE, OPTIONS } = await import("../../app/api/mcp/route");
  const { writeDb } = await import("@/lib/db");
  const { zipStatusResolver } = await import("@/lib/zip-status");

  const env = { ...process.env };
  beforeEach(() => {
    zipStatusResolver.clear();
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub("93618")];
      db.demoRequests = [];
    });
  });
  afterEach(() => {
    for (const key of ["MCP_BEARER_TOKEN", "MCP_ALLOWED_ORIGINS", "MCP_CEREBRO_CHAT", "NODE_ENV"]) {
      if (env[key] === undefined) Reflect.deleteProperty(process.env, key);
      else Object.assign(process.env, { [key]: env[key] });
    }
  });
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
    POST(new Request(URL_MCP, { method: "POST", headers: { ...JSON_HEADERS, ...headers }, body: raw ?? JSON.stringify(body) }));

  describe("tools", () => {
    it("answers open, locked and invalid ZIP codes from the paid ledger", () => {
      const locked = tools.checkZip("93618");
      assert.equal(locked.status, "locked");
      assert.equal(locked.available, false);
      assert.match(locked.message, /locked/);
      const open = tools.checkZip(" 93619 ");
      assert.equal(open.status, "open");
      assert.equal(open.available, true);
      const bad = tools.checkZip("abc");
      assert.deepEqual([bad.valid, bad.status, bad.available, bad.demand], [false, "invalid", false, null]);
    });

    it("checks a batch: de-duplicated, capped, grouped", () => {
      const zips = ["93618", "93618", "93619", "nope", ...Array.from({ length: 20 }, (_, i) => String(90001 + i))];
      const { results, skipped } = tools.checkZips(zips);
      assert.equal(results.length, tools.MAX_BATCH_ZIPS);
      assert.equal(results.filter((r) => r.zip === "93618").length, 1);
      assert.ok(skipped > 0);
    });

    it("finds nearby open ZIP codes through the same lookup the website uses", async () => {
      const calls: unknown[] = [];
      const stub = async (zip: string, options: { limit: number }) => {
        calls.push([zip, options.limit]);
        return { neighbors: [{ zip: "93619", city: "Dinuba", state: "CA", miles: 1.2 }], unknownCount: 0, checked: 1 };
      };
      const answer = await tools.nearbyOpenZips("93618", 99, stub);
      assert.deepEqual(calls, [["93618", 5]]);
      assert.equal(answer.neighbors[0].zip, "93619");
      assert.equal((await tools.nearbyOpenZips("x", 3, stub)).valid, false);
      assert.equal(calls.length, 1, "an invalid ZIP code makes no lookup");
    });

    it("explains locking and plans without promising a lock before payment", () => {
      const info = tools.zipLockInfo();
      const text = JSON.stringify(info);
      assert.match(text, /locks to you at your first payment/);
      assert.match(text, /does not lock a ZIP code/);
      assert.match(text, /within YPN USA/);
      assert.ok(info.plans.some((p) => p.name === "Free" && p.price === "$0"));
      assert.ok(!/\$29\.99/.test(text), "the retired price");
      assert.ok(info.links.checkZip.endsWith("/check-zip"));
    });

    it("describes Cerebro as the code behaves: email follow-ups on their own by default, texts not sent", () => {
      const text = JSON.stringify(tools.cerebroOverview());
      assert.match(text, /go out on their own by default/);
      assert.match(text, /\\"approve\\" mode/);
      assert.match(text, /Text messages and calls are not sent yet/);
      assert.match(text, /not a lender/);
    });

    it("limits ask_cerebro per caller and overall, and passes the session through", async () => {
      const seen: unknown[] = [];
      let allowed = true;
      let retry = 0;
      const deps = {
        runTurn: async (input: { sessionId?: string; mode: string; userMessage: string; funnelSource?: string }) => {
          seen.push(input);
          return { sessionId: "s1", reply: "hi", capturedFields: {}, status: "active" } as never;
        },
        limit: () => ({ ok: allowed, retryAfter: retry }),
      };
      const ok = await tools.askCerebro({ message: "  hello  ", sessionId: " s0 " }, "1.2.3.4", deps);
      assert.deepEqual(ok, { ok: true, sessionId: "s1", reply: "hi" });
      assert.deepEqual(seen, [{ mode: "public_site", sessionId: "s0", funnelSource: "mcp", userMessage: "hello" }]);
      assert.equal((await tools.askCerebro({ message: "   " }, "x", deps)).ok, false);
      allowed = false;
      retry = 7;
      const limited = await tools.askCerebro({ message: "hello" }, "x", deps);
      assert.deepEqual(limited, { ok: false, error: "Too many Cerebro messages. Try again in 7 seconds." });
      assert.equal(seen.length, 1, "a limited call never reaches the model");
    });
  });

  describe("transport", () => {
    it("POST: initialize returns JSON with the server's name, tools capability and instructions", async () => {
      const res = await post(INIT);
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type") ?? "", /application\/json/);
      assert.equal(res.headers.get("mcp-session-id"), null, "stateless: no session id is issued");
      const body = await res.json();
      assert.equal(body.result.serverInfo.name, "ypn-usa");
      assert.ok(body.result.capabilities.tools);
      assert.match(body.result.instructions, /first payment/);
    });

    it("POST: tools/list shows every tool with an input schema and read-only hints", async () => {
      const res = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, { "mcp-protocol-version": "2025-06-18" });
      const { result } = await res.json();
      const names = result.tools.map((t: { name: string }) => t.name).sort();
      assert.deepEqual(names, [
        "ask_cerebro",
        "check_zip_availability",
        "check_zip_availability_batch",
        "find_nearby_open_zips",
        "get_cerebro_overview",
        "get_zip_lock_info",
      ]);
      const zip = result.tools.find((t: { name: string }) => t.name === "check_zip_availability");
      assert.equal(zip.inputSchema.required[0], "zip");
      assert.equal(zip.annotations.readOnlyHint, true);
      assert.equal(result.tools.find((t: { name: string }) => t.name === "ask_cerebro").annotations.readOnlyHint, true);
    });

    it("POST: tools/call returns text and structured content", async () => {
      const res = await post(
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_zip_availability", arguments: { zip: "93618" } } },
        { "mcp-protocol-version": "2025-06-18" },
      );
      const { result } = await res.json();
      assert.equal(result.structuredContent.status, "locked");
      assert.equal(JSON.parse(result.content[0].text).zip, "93618");
      assert.ok(!result.isError);
    });

    it("POST: an invalid ZIP code is a tool error, not a protocol error", async () => {
      const res = await post(
        { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "check_zip_availability", arguments: { zip: "abc" } } },
        { "mcp-protocol-version": "2025-06-18" },
      );
      assert.equal(res.status, 200);
      const { result } = await res.json();
      assert.equal(result.isError, true);
      assert.equal(result.structuredContent.status, "invalid");
    });

    it("POST: a notification is accepted with 202 and no body", async () => {
      const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" }, { "mcp-protocol-version": "2025-06-18" });
      assert.equal(res.status, 202);
    });

    it("POST: bad JSON is 400, a missing Accept is 406, an oversized body is 413", async () => {
      assert.equal((await post(null, {}, "{not json")).status, 400);
      const noAccept = await POST(new Request(URL_MCP, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(INIT) }));
      assert.equal(noAccept.status, 406);
      const big = await post(null, { "content-length": String(1024 * 1024) }, JSON.stringify({ pad: "x".repeat(70 * 1024) }));
      assert.equal(big.status, 413);
    });

    it("GET: 405 with Allow, because this server offers no SSE stream", async () => {
      const res = await GET(new Request(URL_MCP, { headers: { accept: "text/event-stream" } }));
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST, OPTIONS", "Allow lists only what works");
      assert.equal((await res.json()).error.code, -32000);
    });

    it("DELETE: 405 with Allow, because no session is ever issued", async () => {
      const res = await DELETE(new Request(URL_MCP, { method: "DELETE", headers: { "mcp-session-id": "abc" } }));
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST, OPTIONS");
    });

    it("any other method is 405", async () => {
      const res = await handleMcpRequest(new Request(URL_MCP, { method: "PUT" }));
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST, OPTIONS");
    });

    it("rate limits one caller's POSTs", async () => {
      const headers = { "x-forwarded-for": "198.51.100.77" };
      let last = 0;
      for (let i = 0; i < 125; i++) last = (await post(INIT, headers)).status;
      assert.equal(last, 429);
    });
  });

  describe("CORS and origin", () => {
    it("answers an allowed origin's preflight with 204 and the MCP headers, no credentials", async () => {
      const res = await OPTIONS(new Request(URL_MCP, { method: "OPTIONS", headers: { origin: "https://claude.ai", "access-control-request-method": "POST" } }));
      assert.equal(res.status, 204);
      assert.equal(res.headers.get("access-control-allow-origin"), "https://claude.ai");
      assert.match(res.headers.get("access-control-allow-methods") ?? "", /POST, GET, DELETE, OPTIONS/);
      assert.match(res.headers.get("access-control-allow-headers") ?? "", /Mcp-Session-Id/);
      assert.match(res.headers.get("access-control-allow-headers") ?? "", /Authorization/);
      assert.match(res.headers.get("access-control-expose-headers") ?? "", /Mcp-Session-Id/);
      assert.equal(res.headers.get("access-control-allow-credentials"), null);
      assert.match(res.headers.get("vary") ?? "", /Origin/);
    });

    it("puts the same CORS headers on real responses", async () => {
      const res = await post(INIT, { origin: "https://claude.ai" });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), "https://claude.ai");
      assert.equal(res.headers.get("cache-control"), "no-store");
    });

    it("rejects a browser origin that is not allowed, for the preflight and for POST", async () => {
      const pre = await OPTIONS(new Request(URL_MCP, { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
      assert.equal(pre.status, 403);
      assert.equal(pre.headers.get("access-control-allow-origin"), null);
      const res = await post(INIT, { origin: "https://evil.example" });
      assert.equal(res.status, 403);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    });

    it("lets a request with no Origin header through (Claude's backend, CLI, curl)", async () => {
      const res = await post(INIT);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    });

    it("allows extra origins from MCP_ALLOWED_ORIGINS, and localhost only outside production", () => {
      assert.equal(originAllowed("https://partner.example"), false);
      process.env.MCP_ALLOWED_ORIGINS = "https://partner.example/, https://other.example";
      assert.equal(originAllowed("https://partner.example"), true);
      assert.equal(originAllowed("https://other.example"), true);
      Object.assign(process.env, { NODE_ENV: "development" });
      assert.equal(originAllowed("http://localhost:6274"), true);
      assert.equal(originAllowed("http://127.0.0.1:3000"), true);
      assert.equal(originAllowed("http://localhost.evil.example"), false);
      Object.assign(process.env, { NODE_ENV: "production" });
      assert.equal(originAllowed("http://localhost:6274"), false);
    });

    it("the preflight needs no token, but with MCP_BEARER_TOKEN set every other call does", async () => {
      process.env.MCP_BEARER_TOKEN = "s3cret-token";
      const pre = await OPTIONS(new Request(URL_MCP, { method: "OPTIONS", headers: { origin: "https://claude.ai" } }));
      assert.equal(pre.status, 204);
      const none = await post(INIT, { origin: "https://claude.ai" });
      assert.equal(none.status, 401);
      assert.match(none.headers.get("www-authenticate") ?? "", /Bearer/);
      assert.equal(none.headers.get("access-control-allow-origin"), "https://claude.ai", "a browser can read the 401");
      assert.equal((await post(INIT, { authorization: "Bearer wrong" })).status, 401);
      assert.equal((await post(INIT, { authorization: "Bearer s3cret-toke" })).status, 401, "a prefix is not enough");
      assert.equal((await post(INIT, { authorization: "Bearer s3cret-token" })).status, 200);
      assert.equal((await GET(new Request(URL_MCP))).status, 401, "GET is gated too");
    });
  });

  describe("a real MCP client over the route", () => {
    let client: Client;
    before(async () => {
      client = new Client({ name: "claude-test", version: "1.0.0" });
      const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), {
        fetch: async (input, init) => handleMcpRequest(new Request(input, init)),
      });
      await client.connect(transport);
    });
    after(async () => {
      await client.close();
    });

    it("connects, lists tools and calls them, tolerating the 405 on GET", async () => {
      assert.equal(client.getServerVersion()?.name, "ypn-usa");
      const { tools: list } = await client.listTools();
      assert.equal(list.length, 6);

      const locked = await client.callTool({ name: "check_zip_availability", arguments: { zip: "93618" } });
      assert.equal((locked.structuredContent as { status: string }).status, "locked");

      const batch = await client.callTool({ name: "check_zip_availability_batch", arguments: { zips: ["93618", "93619", "zzz"] } });
      const grouped = batch.structuredContent as { open: string[]; locked: string[]; invalid: string[] };
      assert.deepEqual([grouped.open, grouped.locked], [["93619"], ["93618"]]);
      assert.equal(grouped.invalid.length, 1);

      const lock = await client.callTool({ name: "get_zip_lock_info", arguments: {} });
      assert.match(JSON.stringify(lock.structuredContent), /first payment/);

      const cerebro = await client.callTool({ name: "get_cerebro_overview", arguments: {} });
      assert.match(JSON.stringify(cerebro.structuredContent), /Cerebro/);

      const asked = await client.callTool({ name: "ask_cerebro", arguments: { message: "What does YPN USA do?" } });
      assert.ok(!asked.isError, JSON.stringify(asked));
      const reply = asked.structuredContent as { sessionId: string; reply: string };
      assert.ok(reply.sessionId && reply.reply.length > 0);
    });

    it("answers a missing argument as a tool error the model can read and fix", async () => {
      const res = await client.callTool({ name: "check_zip_availability", arguments: {} });
      assert.equal(res.isError, true);
      assert.match(JSON.stringify(res.content), /zip/i);
    });
  });

  it("does not register ask_cerebro when MCP_CEREBRO_CHAT=off", async () => {
    process.env.MCP_CEREBRO_CHAT = "off";
    const res = await post({ jsonrpc: "2.0", id: 9, method: "tools/list" }, { "mcp-protocol-version": "2025-06-18" });
    const names = (await res.json()).result.tools.map((t: { name: string }) => t.name);
    assert.ok(!names.includes("ask_cerebro"));
    assert.equal(names.length, 5);
  });
});
