import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { GeminiProvider } from "./gemini-provider";
import { FailoverAiProvider, getAiProvider, resetAiProviderCache, type AiProvider } from "./provider";

const KEYS = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "AI_PROVIDER"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetAiProviderCache();
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetAiProviderCache();
  mock.restoreAll();
});

const ok = (name: string, text = name): AiProvider => ({ name, generate: async () => ({ text, toolCalls: [], stopReason: "end_turn" }) });
const failing = (name: string): AiProvider => ({
  name,
  generate: async () => {
    throw new Error(`${name} down`);
  },
});

describe("getAiProvider selection", () => {
  it("returns null with no keys", () => {
    assert.equal(getAiProvider(), null);
  });

  it("uses a lone Gemini key directly", () => {
    process.env.GEMINI_API_KEY = "g";
    assert.equal(getAiProvider()?.name, "gemini");
  });

  it("orders openai, anthropic, gemini by default and chains them as backups", () => {
    process.env.OPENAI_API_KEY = "o";
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.GEMINI_API_KEY = "g";
    assert.equal(getAiProvider()?.name, "openai+anthropic+gemini");
  });

  it("puts the pinned provider first", () => {
    process.env.OPENAI_API_KEY = "o";
    process.env.GEMINI_API_KEY = "g";
    process.env.AI_PROVIDER = "gemini";
    assert.equal(getAiProvider()?.name, "gemini+openai");
  });

  it("ignores a pin whose key is missing", () => {
    process.env.OPENAI_API_KEY = "o";
    process.env.AI_PROVIDER = "gemini";
    assert.equal(getAiProvider()?.name, "openai");
  });
});

describe("FailoverAiProvider", () => {
  const request = { system: "s", messages: [{ role: "user" as const, content: "hi" }] };

  it("falls through to the next provider when the first throws", async () => {
    mock.method(console, "error", () => {});
    const result = await new FailoverAiProvider([failing("a"), ok("b", "from b")]).generate(request);
    assert.equal(result.text, "from b");
  });

  it("rethrows the last error when every provider fails", async () => {
    mock.method(console, "error", () => {});
    await assert.rejects(new FailoverAiProvider([failing("a"), failing("b")]).generate(request), /b down/);
  });
});

describe("GeminiProvider", () => {
  it("maps messages and tools to Gemini's format and parses function calls", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    let captured: { url: string; init: RequestInit } | undefined;
    mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
      captured = { url, init };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: "Checking." }, { functionCall: { name: "get_pricing", args: { plan: "pro" } } }] } }] }),
        { status: 200 },
      );
    });

    const result = await new GeminiProvider().generate({
      system: "be helpful",
      messages: [
        { role: "user", content: "hi" },
        { role: "user", content: "[tool result] x" },
        { role: "assistant", content: "ok" },
      ],
      tools: [{ name: "get_pricing", description: "d", inputSchema: { type: "object", properties: { plan: { type: "string" } }, additionalProperties: false } }],
    });

    assert.equal(result.text, "Checking.");
    assert.deepEqual(result.toolCalls, [{ toolName: "get_pricing", input: { plan: "pro" } }]);
    assert.equal(result.stopReason, "tool_use");
    assert.match(captured!.url, /gemini-3\.8-flash:generateContent$/);
    assert.equal((captured!.init.headers as Record<string, string>)["x-goog-api-key"], "test-key");
    const sent = JSON.parse(String(captured!.init.body));
    assert.equal(sent.contents.length, 2);
    assert.equal(sent.contents[0].parts.length, 2);
    assert.equal(sent.contents[1].role, "model");
    assert.equal("additionalProperties" in sent.tools[0].functionDeclarations[0].parameters, false);
  });

  it("throws a status-only error without leaking the response body", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mock.method(globalThis, "fetch", async () => new Response("secret quota details", { status: 429 }));
    await assert.rejects(
      new GeminiProvider().generate({ system: "s", messages: [{ role: "user", content: "hi" }] }),
      (error: Error) => /429/.test(error.message) && !/secret/.test(error.message),
    );
  });
});
