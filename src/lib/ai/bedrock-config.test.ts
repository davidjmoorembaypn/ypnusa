import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { AnthropicProvider } from "./anthropic-provider";
import { resolveBedrockConfig } from "./bedrock-config";
import { getAiProvider, resetAiProviderCache } from "./provider";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-bedrock-"));
const missingFile = path.join(tmp, "does-not-exist.json");

function env(values: Record<string, string>): Record<string, string> {
  // Always point the file lookup at a path that does not exist unless a test overrides it,
  // so a real ~/.ypnus/aws-bedrock.json on the developer's machine cannot leak into tests.
  return { AWS_BEDROCK_CONFIG_FILE: missingFile, ...values };
}

describe("resolveBedrockConfig", () => {
  beforeEach(() => mock.method(console, "error", () => {}));
  afterEach(() => mock.restoreAll());

  it("is off by default, and off when USE_BEDROCK is not true", () => {
    assert.equal(resolveBedrockConfig(env({ AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b" })), null);
    assert.equal(resolveBedrockConfig(env({ USE_BEDROCK: "false", AWS_REGION: "us-east-2" })), null);
  });

  it("reads region and key pair from the environment", () => {
    const cfg = resolveBedrockConfig(
      env({ USE_BEDROCK: "true", AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "AKIATEST", AWS_SECRET_ACCESS_KEY: "secret", AWS_SESSION_TOKEN: "tok", BEDROCK_MODEL: "anthropic.claude-sonnet-5" }),
    );
    assert.deepEqual(cfg, {
      region: "us-east-2",
      accessKeyId: "AKIATEST",
      secretAccessKey: "secret",
      sessionToken: "tok",
      apiKey: undefined,
      model: "anthropic.claude-sonnet-5",
    });
  });

  it("accepts a Bedrock API key instead of a key pair", () => {
    const cfg = resolveBedrockConfig(env({ USE_BEDROCK: "TRUE", AWS_REGION: "us-east-1", AWS_BEARER_TOKEN_BEDROCK: "bearer-value" }));
    assert.equal(cfg?.apiKey, "bearer-value");
  });

  it("refuses to enable with a missing region or a half key pair", () => {
    assert.equal(resolveBedrockConfig(env({ USE_BEDROCK: "true", AWS_ACCESS_KEY_ID: "a", AWS_SECRET_ACCESS_KEY: "b" })), null);
    assert.equal(resolveBedrockConfig(env({ USE_BEDROCK: "true", AWS_REGION: "us-east-2", AWS_ACCESS_KEY_ID: "only-one" })), null);
  });

  it("can be configured entirely from a private file (for hosts where env vars cannot be edited)", () => {
    const file = path.join(tmp, "aws-bedrock.json");
    fs.writeFileSync(file, JSON.stringify({ useBedrock: true, region: "us-west-2", accessKeyId: "AKIAFILE", secretAccessKey: "filesecret" }));
    const cfg = resolveBedrockConfig({ AWS_BEDROCK_CONFIG_FILE: file });
    assert.equal(cfg?.region, "us-west-2");
    assert.equal(cfg?.accessKeyId, "AKIAFILE");
    // An explicit USE_BEDROCK=false in the environment overrides the file's flag.
    assert.equal(resolveBedrockConfig({ AWS_BEDROCK_CONFIG_FILE: file, USE_BEDROCK: "false" }), null);
    // Environment values win over the file per field.
    assert.equal(resolveBedrockConfig({ AWS_BEDROCK_CONFIG_FILE: file, AWS_REGION: "eu-west-1" })?.region, "eu-west-1");
  });

  it("never throws on a corrupt config file", () => {
    const file = path.join(tmp, "corrupt.json");
    fs.writeFileSync(file, "{ not json");
    assert.equal(resolveBedrockConfig({ AWS_BEDROCK_CONFIG_FILE: file }), null);
  });
});

describe("backend selection", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    resetAiProviderCache();
    for (const key of Object.keys(process.env)) {
      if (key === "USE_BEDROCK" || key === "ANTHROPIC_API_KEY" || key.startsWith("AWS_")) delete process.env[key];
    }
    process.env.AWS_BEDROCK_CONFIG_FILE = missingFile;
    process.env.ANTHROPIC_API_KEY_FILE = missingFile;
  });
  afterEach(() => {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    resetAiProviderCache();
  });

  it("uses the standard Anthropic API when only an Anthropic key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    assert.equal(getAiProvider()?.name, "anthropic");
  });

  it("uses Bedrock only when USE_BEDROCK=true, even if an Anthropic key is also set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.USE_BEDROCK = "true";
    process.env.AWS_REGION = "us-east-2";
    process.env.AWS_ACCESS_KEY_ID = "AKIATEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    assert.equal(getAiProvider()?.name, "bedrock");
  });

  it("is not configured when nothing is set", () => {
    assert.equal(getAiProvider(), null);
  });
});

describe("request shape is identical on both backends (tool use + prompt caching)", () => {
  const tools = [
    { name: "a_tool", description: "first", inputSchema: { type: "object" as const, properties: {} } },
    { name: "b_tool", description: "last", inputSchema: { type: "object" as const, properties: {} } },
  ];

  interface CapturedParams {
    model: string;
    system: unknown;
    tools: Array<{ cache_control?: unknown }>;
    output_config: unknown;
  }

  async function captureParams(provider: AnthropicProvider) {
    let captured: CapturedParams | undefined;
    (provider as unknown as { client: unknown }).client = {
      messages: {
        create: async (params: CapturedParams) => {
          captured = params;
          return {
            stop_reason: "tool_use",
            content: [
              { type: "text", text: "ok" },
              { type: "tool_use", name: "b_tool", input: { x: 1 } },
            ],
          };
        },
      },
    };
    const result = await provider.generate({ system: "SYS", messages: [{ role: "user", content: "hi" }], tools });
    assert.ok(captured, "provider.generate did not call the model");
    return { captured, result };
  }

  it("sends cache_control on the system prompt and the last tool, and parses tool_use, for Bedrock", async () => {
    const provider = new AnthropicProvider({ kind: "bedrock", config: { region: "us-east-2", apiKey: "k", model: "anthropic.claude-opus-5" } });
    assert.equal(provider.name, "bedrock");
    const { captured, result } = await captureParams(provider);
    assert.equal(captured.model, "anthropic.claude-opus-5");
    assert.deepEqual(captured.system, [{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }]);
    assert.equal(captured.tools[0].cache_control, undefined);
    assert.deepEqual(captured.tools[1].cache_control, { type: "ephemeral" });
    assert.deepEqual(captured.output_config, { effort: "medium" });
    assert.deepEqual(result.toolCalls, [{ toolName: "b_tool", input: { x: 1 } }]);
  });

  it("keeps the standard Anthropic model id and the same request shape", async () => {
    const provider = new AnthropicProvider({ kind: "anthropic", apiKey: "sk-ant-test" });
    const { captured } = await captureParams(provider);
    assert.equal(captured.model, process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5");
    assert.deepEqual(captured.system, [{ type: "text", text: "SYS", cache_control: { type: "ephemeral" } }]);
    assert.deepEqual(captured.tools[1].cache_control, { type: "ephemeral" });
  });
});
