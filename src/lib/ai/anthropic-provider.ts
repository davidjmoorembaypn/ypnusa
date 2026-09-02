import Anthropic from "@anthropic-ai/sdk";
import type { AiGenerateRequest, AiGenerateResult, AiProvider, AiToolCall } from "./provider";

/**
 * Default model: claude-opus-5 (Anthropic's current flagship). Override with
 * AI_MODEL for cost/latency tuning once this sees real production traffic —
 * see docs/ai-assistant.md for the tradeoffs.
 */
const DEFAULT_MODEL = "claude-opus-5";
const DEFAULT_MAX_TOKENS = 4096;

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    // No-arg constructor resolves ANTHROPIC_API_KEY from the environment —
    // never hardcode a key here or accept one over the wire from a client.
    this.client = new Anthropic();
    this.model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: request.system,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      tools: request.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
      output_config: { effort: "medium" },
    });

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
