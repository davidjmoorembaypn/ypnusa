import type { AiGenerateRequest, AiGenerateResult, AiProvider, AiToolCall } from "./provider";

/**
 * Google Gemini via the public REST API (no SDK dependency). Works with a free
 * Google AI Studio key (https://aistudio.google.com/apikey), which needs no billing
 * account. Free-tier quotas are modest and Google may use free-tier prompts to improve
 * its products; use a billed key before sending real borrower PII at volume.
 *
 * Default model: gemini-3.8-flash (free-tier eligible, supports function calling).
 * Override with GEMINI_MODEL when a newer Flash model is available on your key.
 */
const DEFAULT_MODEL = "gemini-3.8-flash";
const DEFAULT_MAX_TOKENS = 4096;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> } };

/** Gemini accepts an OpenAPI-style subset of JSON Schema; drop keys it rejects. */
function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
      if (key === "additionalProperties" || key === "$schema") continue;
      out[key] = toGeminiSchema(value);
    }
    return out;
  }
  return schema;
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly model: string;

  constructor() {
    this.model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  }

  async generate(request: AiGenerateRequest): Promise<AiGenerateResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

    // Gemini wants alternating user/model turns, so merge consecutive same-role messages.
    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const message of request.messages) {
      const role = message.role === "assistant" ? "model" : "user";
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts.push({ text: message.content });
      else contents.push({ role, parts: [{ text: message.content }] });
    }

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents,
      generationConfig: { maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS },
    };
    if (request.tools?.length) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: toGeminiSchema(tool.inputSchema),
          })),
        },
      ];
    }

    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      // Status only: the response body can echo request details, so keep it out of the message.
      throw new Error(`Gemini request failed (${response.status}).`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (data.promptFeedback?.blockReason) {
      throw new Error(`The assistant declined to respond (${data.promptFeedback.blockReason}).`);
    }
    const candidate = data.candidates?.[0];
    if (!candidate) throw new Error("The assistant returned no response.");

    let text = "";
    const toolCalls: AiToolCall[] = [];
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) text += part.text;
      if (part.functionCall) toolCalls.push({ toolName: part.functionCall.name, input: part.functionCall.args ?? {} });
    }

    return {
      text,
      toolCalls,
      stopReason: toolCalls.length ? "tool_use" : (candidate.finishReason ?? "end_turn"),
    };
  }
}
