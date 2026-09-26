import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AnthropicProvider } from "./anthropic-provider";

/**
 * Provider-agnostic seam for the AI assistant (src/lib/ai/chat-agent.ts).
 *
 * Nothing outside this file (and anthropic-provider.ts) should import an SDK
 * directly — that keeps the rest of the assistant swappable to a different
 * model host later without touching prompts, routing, or persistence.
 */

/**
 * Minimal JSON Schema shape Anthropic's tool_use input_schema requires. The
 * index signature matches the SDK's own `InputSchema` type, which is
 * intentionally open-ended beyond `type`.
 */
export interface AiToolInputSchema {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  [key: string]: unknown;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: AiToolInputSchema;
}

export interface AiToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiGenerateRequest {
  system: string;
  messages: AiMessage[];
  tools?: AiToolDefinition[];
  maxTokens?: number;
}

export interface AiGenerateResult {
  text: string;
  toolCalls: AiToolCall[];
  stopReason: string;
}

export interface AiProvider {
  readonly name: string;
  generate(request: AiGenerateRequest): Promise<AiGenerateResult>;
}

export class AiProviderNotConfiguredError extends Error {
  constructor(
    message = "No AI provider is configured yet. Set ANTHROPIC_API_KEY to enable the assistant — see docs/ai-assistant.md.",
  ) {
    super(message);
    this.name = "AiProviderNotConfiguredError";
  }
}

/**
 * Resolves the Anthropic API key. Order: the ANTHROPIC_API_KEY env var, then a
 * private key file (ANTHROPIC_API_KEY_FILE, default ~/.ypnus/anthropic-api-key).
 * The file path exists because shared hosting cannot always set one env var
 * without replacing the whole set. Keep the file outside the web root, mode 600.
 * Never log the value.
 */
export function resolveAnthropicApiKey(): string | null {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  // turbopackIgnore: the path is only known at runtime; without it the build's file tracer
  // treats this read as "could be anything" and copies the whole repo into the deploy bundle.
  const filePath =
    process.env.ANTHROPIC_API_KEY_FILE?.trim() || path.join(/*turbopackIgnore: true*/ os.homedir(), ".ypnus", "anthropic-api-key");
  try {
    const fromFile = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8").trim();
    return fromFile || null;
  } catch {
    return null;
  }
}

let cachedProvider: AiProvider | null | undefined;

/**
 * Resolves the configured AI provider, or null when none is configured.
 *
 * TODO(ai-provider): to add another backend, implement AiProvider in a sibling
 * file (mirroring anthropic-provider.ts) and select it here based on whatever
 * env var you introduce for it — callers never need to change.
 */
export function getAiProvider(): AiProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const apiKey = resolveAnthropicApiKey();
  if (!apiKey) {
    cachedProvider = null;
    return cachedProvider;
  }

  cachedProvider = new AnthropicProvider(apiKey);
  return cachedProvider;
}

/** Test-only: clears the memoized provider so env var changes take effect. */
export function resetAiProviderCache(): void {
  cachedProvider = undefined;
}
