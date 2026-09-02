import Anthropic from "@anthropic-ai/sdk";
import { generateId } from "@/lib/id";
import { readChatSession, saveChatSession } from "@/lib/db";
import type { AssistantMode, ChatCapturedFields, ChatMessageRecord, ChatSessionRecord } from "@/lib/types";
import { getAiProvider } from "./provider";
import {
  buildSystemPrompt,
  CAPTURE_LEAD_QUALIFICATION_TOOL,
  type LeadQualificationToolInput,
} from "./prompts";

/** Keeps token growth (and the on-disk snapshot) bounded for long-running sessions. */
const MAX_MESSAGES_PER_SESSION = 60;
const MAX_MESSAGE_LENGTH = 4000;

export interface AssistantTurnInput {
  mode: AssistantMode;
  sessionId?: string;
  /** Signed-in session subject (src/lib/session.ts) — set for mlo_dashboard turns. */
  userId?: string;
  funnelSource?: string;
  userMessage: string;
}

export interface AssistantTurnResult {
  sessionId: string;
  reply: string;
  capturedFields: ChatCapturedFields;
  summary?: string;
  leadScore?: number;
  recommendedAction?: string;
  status: ChatSessionRecord["status"];
  /** False whenever no AI provider is configured — the route surfaces this so the UI can show a setup notice instead of treating it as a normal outage. */
  providerConfigured: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function loadOrCreateSession(input: AssistantTurnInput): ChatSessionRecord {
  const existing = input.sessionId ? readChatSession(input.sessionId) : null;
  if (existing && existing.mode === input.mode) {
    // mlo_dashboard sessions are bound to the signed-in user who started them —
    // never let a different session subject resume someone else's transcript.
    const ownedByCaller = input.mode !== "mlo_dashboard" || existing.userId === input.userId;
    if (ownedByCaller) return existing;
  }

  return {
    // Always mint a fresh id server-side rather than trusting a client-supplied
    // one — a stale/foreign sessionId falls through to a brand-new session.
    id: generateId("chat"),
    mode: input.mode,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    userId: input.userId,
    funnelSource: input.funnelSource,
    messages: [],
    capturedFields: {},
    status: "active",
  };
}

function appendMessage(session: ChatSessionRecord, role: ChatMessageRecord["role"], content: string): void {
  session.messages.push({ id: generateId("msg"), role, content, createdAt: nowIso() });
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages.splice(0, session.messages.length - MAX_MESSAGES_PER_SESSION);
  }
}

/** Merges tool-reported fields into the session, keeping prior values when the model omits a key. */
function mergeCapturedFields(
  session: ChatSessionRecord,
  input: LeadQualificationToolInput,
): void {
  const next: ChatCapturedFields = { ...session.capturedFields };
  if (input.name !== undefined) next.name = input.name;
  if (input.email !== undefined) next.email = input.email;
  if (input.phone !== undefined) next.phone = input.phone;
  if (input.city !== undefined) next.city = input.city;
  if (input.state !== undefined) next.state = input.state;
  if (input.leadType !== undefined) next.leadType = input.leadType;
  if (input.urgency !== undefined) next.urgency = input.urgency;
  if (input.consent !== undefined) next.consent = input.consent;
  session.capturedFields = next;

  if (typeof input.summary === "string" && input.summary.trim()) session.summary = input.summary.trim();
  if (typeof input.leadQualityScore === "number" && Number.isFinite(input.leadQualityScore)) {
    session.leadScore = Math.max(0, Math.min(100, Math.round(input.leadQualityScore)));
  }
  if (typeof input.recommendedNextAction === "string" && input.recommendedNextAction.trim()) {
    session.recommendedAction = input.recommendedNextAction.trim();
  }

  const f = session.capturedFields;
  if (f.consent === true && f.name && (f.email || f.phone) && f.leadType) {
    session.status = "qualified";
  }
}

function describeProviderError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "The assistant's credentials are misconfigured — an operator needs to check ANTHROPIC_API_KEY.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "The assistant is getting a lot of requests right now — please try again in a moment.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach the assistant service. Please try again.";
  }
  if (error instanceof Anthropic.APIError) {
    return "The assistant hit an unexpected error. Please try again.";
  }
  return error instanceof Error && error.message
    ? error.message
    : "The assistant is temporarily unavailable. Please try again.";
}

/**
 * Runs one turn of the assistant conversation: persists the user message,
 * calls the configured AI provider (if any), extracts structured lead
 * fields for lead_qualification mode, and persists the assistant's reply.
 *
 * Always persists the session — the file-backed store (src/lib/db.ts) is
 * always present in this app and degrades to in-memory-only on read-only
 * filesystems on its own, so there is no "if the database exists" branch
 * to take here.
 */
export async function runAssistantTurn(input: AssistantTurnInput): Promise<AssistantTurnResult> {
  const session = loadOrCreateSession(input);
  const userMessage = input.userMessage.trim().slice(0, MAX_MESSAGE_LENGTH);
  appendMessage(session, "user", userMessage);

  const provider = getAiProvider();
  if (!provider) {
    // TODO(ai-provider): once ANTHROPIC_API_KEY is set in the deployment
    // environment, this branch stops firing automatically — nothing else to
    // wire up. See docs/ai-assistant.md.
    const reply =
      "The AI assistant isn't connected yet — an operator needs to configure the AI provider (see docs/ai-assistant.md). Your message has been saved.";
    appendMessage(session, "assistant", reply);
    session.updatedAt = nowIso();
    saveChatSession(session);
    return {
      sessionId: session.id,
      reply,
      capturedFields: session.capturedFields,
      summary: session.summary,
      leadScore: session.leadScore,
      recommendedAction: session.recommendedAction,
      status: session.status,
      providerConfigured: false,
    };
  }

  const system = buildSystemPrompt(input.mode);
  const history = session.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let reply: string;
  try {
    const result = await provider.generate({
      system,
      messages: history,
      tools: input.mode === "lead_qualification" ? [CAPTURE_LEAD_QUALIFICATION_TOOL] : undefined,
    });

    for (const call of result.toolCalls) {
      if (call.toolName === "capture_lead_qualification") {
        mergeCapturedFields(session, call.input as LeadQualificationToolInput);
      }
    }

    reply = result.text.trim() || "Got it — one moment.";
  } catch (error) {
    console.error("[chat-agent] provider.generate failed", error);
    reply = describeProviderError(error);
  }

  appendMessage(session, "assistant", reply);
  session.updatedAt = nowIso();
  saveChatSession(session);

  return {
    sessionId: session.id,
    reply,
    capturedFields: session.capturedFields,
    summary: session.summary,
    leadScore: session.leadScore,
    recommendedAction: session.recommendedAction,
    status: session.status,
    providerConfigured: true,
  };
}
