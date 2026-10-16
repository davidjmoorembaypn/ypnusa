import { AnthropicProvider } from "./anthropic-provider";
import { OpenAiProvider } from "./openai-provider";

/**
 * Provider-agnostic seam for the AI assistant (src/lib/ai/chat-agent.ts).
 *
 * Nothing outside this file (and anthropic-provider.ts / openai-provider.ts)
 * should import an SDK directly — that keeps the rest of the assistant
 * swappable to a different model host later without touching prompts,
 * routing, or persistence.
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
    message = "No AI provider is configured yet. Set OPENAI_API_KEY (or ANTHROPIC_API_KEY) to enable the assistant — see docs/ai-assistant.md.",
  ) {
    super(message);
    this.name = "AiProviderNotConfiguredError";
  }
}

let cachedProvider: AiProvider | null | undefined;

/**
 * Resolves the configured AI provider, or null when none is configured.
 *
 * Selection: set AI_PROVIDER to "openai" or "anthropic" to pin one
 * explicitly. Left unset, OpenAI is preferred when OPENAI_API_KEY is
 * present (falling back to Anthropic), so switching backends is a pure
 * env-var change on the host — no redeploy of this file required.
 *
 * TODO(ai-provider): to add another backend, implement AiProvider in a
 * sibling file (mirroring anthropic-provider.ts / openai-provider.ts) and
 * add a branch below — callers never need to change.
 */
export function getAiProvider(): AiProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const pinned = process.env.AI_PROVIDER?.trim().toLowerCase();
  const hasOpenAi = Boolean(process.env.OPENAI_API_KEY?.trim());
  const hasAnthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  if (pinned === "openai" && hasOpenAi) {
    cachedProvider = new OpenAiProvider();
  } else if (pinned === "anthropic" && hasAnthropic) {
    cachedProvider = new AnthropicProvider();
  } else if (hasOpenAi) {
    cachedProvider = new OpenAiProvider();
  } else if (hasAnthropic) {
    cachedProvider = new AnthropicProvider();
  } else {
    cachedProvider = null;
  }

  return cachedProvider;
}

/** Test-only: clears the memoized provider so env var changes take effect. */
export function resetAiProviderCache(): void {
  cachedProvider = undefined;
}
