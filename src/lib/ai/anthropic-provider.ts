import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import type { BedrockConfig } from "./bedrock-config";
import type { AiGenerateRequest, AiGenerateResult, AiProvider, AiToolCall } from "./provider";

/** Which backend serves the model: the standard Anthropic API (primary) or Amazon Bedrock. */
export type AiBackend = { kind: "anthropic"; apiKey?: string } | { kind: "bedrock"; config: BedrockConfig };

/**
 * Default model: claude-opus-5 (Anthropic's current flagship). Override with
 * ANTHROPIC_MODEL for cost/latency tuning once this sees real production traffic —
 * see docs/ai-assistant.md for the tradeoffs.
 */
const DEFAULT_MODEL = "claude-opus-5";
/** Bedrock (Mantle endpoint) model ids carry an "anthropic." prefix. */
const DEFAULT_BEDROCK_MODEL = "anthropic.claude-opus-5";
/**
 * Tried in order after the configured model when Bedrock answers 404 "model does not
 * exist". Which Claude models a Bedrock account can call varies by region and by which
 * models were enabled, so the provider finds one that works instead of failing the chat.
 */
const BEDROCK_FALLBACK_MODELS = [
  "anthropic.claude-sonnet-5",
  "anthropic.claude-opus-4-8",
  "anthropic.claude-opus-4-7",
  "anthropic.claude-sonnet-4-6",
  "anthropic.claude-haiku-4-5",
];
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements AiProvider {
  readonly name: string;
  // Both clients expose the same Messages surface (tool use, cache_control, output_config).
  private readonly client: { messages: Anthropic["messages"] };
  /** Models to try, in order. Bedrock has several (see BEDROCK_FALLBACK_MODELS); Anthropic has one. */
  private readonly models: string[];
  /** The model that last worked, so later requests skip the 404 probing. */
  private activeModel: string | undefined;

  constructor(backend: AiBackend | string = { kind: "anthropic" }) {
    // Credentials come from resolveAnthropicApiKey() / resolveBedrockConfig() (env vars or a
    // private server file) - never hardcode one here or accept one over the wire from a client.
    const resolved: AiBackend = typeof backend === "string" ? { kind: "anthropic", apiKey: backend } : backend;
    if (resolved.kind === "bedrock") {
      const { config } = resolved;
      this.name = "bedrock";
      this.client = new AnthropicBedrockMantle({
        awsRegion: config.region,
        // An explicit Bedrock API key wins; otherwise the AWS key pair (+ optional session token);
        // if neither is set the SDK falls back to the default AWS credential chain.
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(!config.apiKey && config.accessKeyId && config.secretAccessKey
          ? {
              awsAccessKey: config.accessKeyId,
              awsSecretAccessKey: config.secretAccessKey,
              awsSessionToken: config.sessionToken ?? null,
            }
          : {}),
      });
      this.models = [...new Set([config.model || DEFAULT_BEDROCK_MODEL, ...BEDROCK_FALLBACK_MODELS])];
      return;
    }
    this.name = "anthropic";
    this.client = new Anthropic(resolved.apiKey ? { apiKey: resolved.apiKey } : undefined);
    this.models = [process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL];
  }

  /** Calls the model, moving to the next candidate only on a 404 (model not available). */
  private async createWithModelFallback(
    build: (model: string) => Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message> {
    const order = this.activeModel
      ? [this.activeModel, ...this.models.filter((model) => model !== this.activeModel)]
      : this.models;
    let lastError: unknown;
    for (const model of order) {
      try {
        const response = await this.client.messages.create(build(model));
        if (this.activeModel !== model) {
          this.activeModel = model;
          if (this.models.length > 1) console.log(`[ai] ${this.name} model in use: ${model}`);
        }
        return response;
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const response = await this.createWithModelFallback((model) => ({
      model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      // The system prompt and tool list are large and identical across turns, so mark
      // the end of them cacheable (5-minute default TTL; cache reads are ~10x cheaper).
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: request.tools?.map((tool, index, all) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
        ...(index === all.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
      })),
      output_config: { effort: "medium" },
    }));

    if (response.stop_reason === "refusal") {
      const category = response.stop_details?.category;
      throw new Error(
        `The assistant declined to respond${category ? ` (${category})` : ""}.`,
      );
    }

    let text = "";
    const toolCalls: AiToolCall[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          toolName: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    return { text, toolCalls, stopReason: response.stop_reason ?? "end_turn" };
  }
}
