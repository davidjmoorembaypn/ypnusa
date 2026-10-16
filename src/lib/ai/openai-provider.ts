import OpenAI from "openai";
import type { AiGenerateRequest, AiGenerateResult, AiProvider, AiToolCall } from "./provider";

/**
 * Default model: gpt-4.1 (stable, strong tool-calling support as of this
 * writing). Override with OPENAI_MODEL once you've confirmed access to a
 * newer model on your account — this file never needs to change for that.
 */
const DEFAULT_MODEL = "gpt-4.1";
const DEFAULT_MAX_TOKENS = 4096;

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    // No-arg constructor resolves OPENAI_API_KEY from the environment —
    // never hardcode a key here or accept one over the wire from a client.
    this.client = new OpenAI();
    this.model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: "system", content: request.system },
        ...request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      tools: request.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema,
        },
      })),
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("The assistant returned no response.");
    }

    if (choice.finish_reason === "content_filter") {
      throw new Error("The assistant declined to respond (content_filter).");
    }

    const toolCalls: AiToolCall[] = [];
    for (const call of choice.message.tool_calls ?? []) {
      if (call.type !== "function") continue;
      let input: Record<string, unknown> = {};
      try {
        input = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        input = {};
      }
      toolCalls.push({ toolName: call.function.name, input });
    }

    return {
      text: choice.message.content ?? "",
      toolCalls,
      stopReason: toolCalls.length ? "tool_use" : (choice.finish_reason ?? "end_turn"),
    };
  }
}
