import { AnthropicProvider } from "./anthropic-provider";
import { GeminiProvider } from "./gemini-provider";
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

/**
 * Tries each provider in order and returns the first success. If one throws for any reason
 * (empty billing balance, rate limit, outage, bad key) the same request moves to the next, so a
 * single exhausted account no longer takes the assistant down. The caller only sees an error
 * when every provider has failed (the last error is rethrown).
 */
export class FailoverAiProvider implements AiProvider {
  readonly name: string;

  constructor(private readonly providers: readonly AiProvider[]) {
    if (providers.length === 0) throw new Error("FailoverAiProvider needs at least one provider.");
    this.name = providers.map((provider) => provider.name).join("+");
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    let lastError: unknown;
    for (const provider of this.providers) {
      try {
        return await provider.generate(request);
      } catch (error) {
        lastError = error;
        console.error(`[ai-provider] ${provider.name} failed`, error);
      }
    }
    throw lastError;
  }
}

let cachedProvider: AiProvider | null | undefined;

/**
 * Resolves the configured AI provider, or null when none is configured.
 *
 * Selection: set AI_PROVIDER to "openai", "anthropic" or "gemini" to choose the primary.
 * Left unset, the order is OpenAI, Anthropic, Gemini (whichever keys are present). Every
 * other configured provider becomes an automatic backup if the primary errors (see
 * FailoverAiProvider). Switching backends is a pure env-var change.
 *
 * TODO(ai-provider): to add another backend, implement AiProvider in a
 * sibling file (mirroring anthropic-provider.ts / openai-provider.ts) and
 * add a branch below — callers never need to change.
 */
export function getAiProvider(): AiProvider | null {
  if (cachedProvider !== undefined) return cachedProvider;

  const pinned = process.env.AI_PROVIDER?.trim().toLowerCase();
  const available: { name: string; make: () => AiProvider }[] = [];
  if (process.env.OPENAI_API_KEY?.trim()) available.push({ name: "openai", make: () => new OpenAiProvider() });
  if (process.env.ANTHROPIC_API_KEY?.trim()) available.push({ name: "anthropic", make: () => new AnthropicProvider() });
  if (process.env.GEMINI_API_KEY?.trim()) available.push({ name: "gemini", make: () => new GeminiProvider() });

  // Pinned provider (when its key is present) goes first; the rest keep the default order and
  // act as automatic backups.
  const ordered = [...available].sort((a, b) => Number(b.name === pinned) - Number(a.name === pinned));
  const chain = ordered.map((entry) => entry.make());
  cachedProvider = chain.length === 0 ? null : chain.length === 1 ? chain[0] : new FailoverAiProvider(chain);

  return cachedProvider;
}

/** Test-only: clears the memoized provider so env var changes take effect. */
export function resetAiProviderCache(): void {
  cachedProvider = undefined;
}
