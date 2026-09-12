import Anthropic from "@anthropic-ai/sdk";
import { generateId } from "@/lib/id";
import { bookAppointment, listSyncedAvailableSlots } from "@/lib/calendar";
import { readChatSession, readDb, saveChatSession } from "@/lib/db";
import { logCrmActivity, routeLoanOfficer } from "@/lib/crm";
import { marketingUrl } from "@/lib/site";
import type {
  AssistantMode,
  BorrowerAnswers,
  ChatCapturedFields,
  ChatMessageRecord,
  ChatSessionRecord,
  LeadQuality,
  LoanProgram,
  QualificationSummary,
} from "@/lib/types";
import { fetchLiveTerritory } from "@/lib/live-territory";
import { findExplainerVideo } from "./explainer-videos";
import { type AiMessage, type AiProvider, type AiToolCall, type AiToolDefinition, getAiProvider } from "./provider";
import {
  buildSystemPrompt,
  CAPTURE_LEAD_QUALIFICATION_TOOL,
  CHECK_TERRITORY_AVAILABILITY_TOOL,
  FIND_EXPLAINER_VIDEO_TOOL,
  REQUEST_HUMAN_HANDOFF_TOOL,
  SCHEDULE_MEETING_TOOL,
  START_SIGNUP_TOOL,
  type LeadQualificationToolInput,
} from "./prompts";
import { runWebsiteAutopilot, type WebsiteAutopilotPlan } from "./website-autopilot";

/** Modes where the assistant talks to a prospective customer, not an MLO about their own pipeline. */
const CUSTOMER_FACING_MODES: AssistantMode[] = ["public_site", "lead_qualification"];

export function toolsForMode(mode: AssistantMode): AiToolDefinition[] {
  const tools: AiToolDefinition[] = [FIND_EXPLAINER_VIDEO_TOOL];
  if (mode === "lead_qualification") {
    tools.push(CAPTURE_LEAD_QUALIFICATION_TOOL, SCHEDULE_MEETING_TOOL, REQUEST_HUMAN_HANDOFF_TOOL);
  }
  if (mode === "public_site") {
    tools.push(START_SIGNUP_TOOL);
  }
  if (CUSTOMER_FACING_MODES.includes(mode)) tools.push(CHECK_TERRITORY_AVAILABILITY_TOOL);
  return tools;
}

function signupUrl(input: { plan?: unknown; zip?: unknown }): string {
  const plan = typeof input.plan === "string" ? input.plan : "free";
  const params = new URLSearchParams({ plan });
  if (typeof input.zip === "string" && input.zip.trim()) params.set("zip", input.zip.trim());
  return marketingUrl(`/lo-signup.html?${params.toString()}`);
}

/** Runs schedule_meeting: lists open slots (no startIso) or books one (startIso given). */
async function executeScheduleMeeting(call: AiToolCall, session: ChatSessionRecord): Promise<string> {
  if (!session.borrowerLeadId) {
    return JSON.stringify({
      error: "not_yet_qualified",
      note: "This lead isn't linked yet — finish gathering name, contact info, and consent first.",
    });
  }

  const lead = readDb().borrowerLeads.find((item) => item.id === session.borrowerLeadId);
  if (!lead) return JSON.stringify({ error: "lead_not_found" });

  const startIso = typeof call.input.startIso === "string" ? call.input.startIso.trim() : "";
  if (!startIso) {
    const slots = await listSyncedAvailableSlots(lead.assignedLoId, 8);
    return JSON.stringify({
      slots: slots.slice(0, 3).map((slot) => ({ startIso: slot.start, endIso: slot.end })),
    });
  }

  try {
    const appointment = await bookAppointment({
      borrowerLeadId: session.borrowerLeadId,
      loId: lead.assignedLoId,
      startIso,
    });
    return JSON.stringify({ booked: true, startIso: appointment.start });
  } catch (error) {
    return JSON.stringify({
      error: "booking_failed",
      message: error instanceof Error ? error.message : "Could not book that time.",
    });
  }
}

/**
 * The number a human handoff dials. Same env var + fallback as the
 * local-SEO business-phone field (src/lib/local-seo.ts) — one number, set
 * once, reused everywhere a real human phone number is needed.
 */
function resolveHandoffPhone(): string {
  return process.env.MLO_PUBLIC_PHONE?.trim() || "+1-559-512-0372";
}

/** Runs one real-world action tool and returns a plain-text result for the model. Never throws. */
async function executeActionTool(call: AiToolCall, session: ChatSessionRecord): Promise<string> {
  try {
    if (call.toolName === "check_territory_availability") {
      const zip = typeof call.input.zip === "string" ? call.input.zip : "";
      const result = await fetchLiveTerritory(zip);
      return result
        ? JSON.stringify({ available: result.available, message: result.message })
        : JSON.stringify({ error: "Territory lookup is temporarily unavailable." });
    }
    if (call.toolName === "find_explainer_video") {
      const topic = typeof call.input.topic === "string" ? call.input.topic : "";
      const video = findExplainerVideo(topic);
      return video
        ? JSON.stringify({ title: video.title, url: video.url, description: video.description })
        : JSON.stringify({ found: false, note: "No explainer video covers this topic yet." });
    }
    if (call.toolName === "start_signup") {
      return JSON.stringify({ url: signupUrl(call.input) });
    }
    if (call.toolName === "schedule_meeting") {
      return await executeScheduleMeeting(call, session);
    }
    if (call.toolName === "request_human_handoff") {
      return JSON.stringify({ connecting: true, phone: resolveHandoffPhone() });
    }
    return JSON.stringify({ error: `Unknown tool: ${call.toolName}` });
  } catch (error) {
    console.error(`[chat-agent] action tool ${call.toolName} failed`, error);
    return JSON.stringify({ error: "That lookup failed. Answer without it." });
  }
}

const MAX_TOOL_ROUNDS = 3;
const ACTION_TOOL_NAMES = new Set([
  "check_territory_availability",
  "find_explainer_video",
  "start_signup",
  "schedule_meeting",
  "request_human_handoff",
]);

/**
 * Runs the model, and — when it calls a real action tool (territory lookup,
 * video search, scheduling, signup link) rather than just the data-capture
 * tool — executes it and feeds the result back for another turn, up to
 * MAX_TOOL_ROUNDS. This is what makes the assistant agentic rather than a
 * single-shot Q&A: it can act on live data mid-conversation instead of only
 * describing what it would do.
 *
 * capture_lead_qualification calls are merged into `session` immediately
 * (via the caller-supplied `mergeCapture`/`linkLead`), before any action
 * tools in that same round run — so a visitor who finishes qualification
 * and asks to schedule a meeting in the same turn gets a session that's
 * already linked (borrowerLeadId set) by the time schedule_meeting checks
 * for one, rather than needing a whole extra round trip. Callers (today,
 * only runAssistantTurn) still get every capture_lead_qualification call
 * back too, since they may want to do their own bookkeeping with it.
 */
export async function runWithTools(
  provider: AiProvider,
  system: string,
  history: AiMessage[],
  tools: AiToolDefinition[],
  session: ChatSessionRecord,
  mergeCapture: (call: AiToolCall) => void,
): Promise<{ text: string; captureCalls: AiToolCall[]; actionCalls: AiToolCall[] }> {
  const messages = [...history];
  const captureCalls: AiToolCall[] = [];
  const allActionCalls: AiToolCall[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const result = await provider.generate({ system, messages, tools });
    for (const call of result.toolCalls) {
      if (call.toolName === "capture_lead_qualification") {
        captureCalls.push(call);
        mergeCapture(call);
      }
    }

    const actionCalls = result.toolCalls.filter((call) => ACTION_TOOL_NAMES.has(call.toolName));
    if (actionCalls.length === 0) {
      return { text: result.text, captureCalls, actionCalls: allActionCalls };
    }
    allActionCalls.push(...actionCalls);

    if (result.text.trim()) messages.push({ role: "assistant", content: result.text.trim() });
    const toolOutputs = await Promise.all(
      actionCalls.map(async (call) => `[${call.toolName} result] ${await executeActionTool(call, session)}`),
    );
    messages.push({ role: "user", content: toolOutputs.join("\n") });
  }

  // Ran out of rounds — ask once more without tools so the model must answer in text.
  const final = await provider.generate({ system, messages });
  return { text: final.text, captureCalls, actionCalls: allActionCalls };
}

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
  /** Set once linkQualifiedLead has linked this session into the borrower-lead / CRM store. */
  borrowerLeadId?: string;
  crmLeadId?: string;
  /** Set when the visitor explicitly asked to talk to a real person (request_human_handoff). Voice callers get dialed to this number; the web widget can surface it as a tap-to-call link. */
  handoffRequested?: boolean;
  handoffPhone?: string;
  /** Set when this turn triggered the Website/Profile Autopilot (mlo_dashboard mode only). */
  autopilot?: {
    summaryForMlo: string;
    autoAppliedCount: number;
    needsApprovalCount: number;
    /** Always true today — this app-side turn never publishes to WordPress; see src/lib/wordpress.ts for the (dry-run-by-default) publishing path. */
    dryRun: boolean;
    topChanges: Array<{ title: string; status: string; riskLevel: string; expectedBenefit: string }>;
  };
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

function inferLoanProgram(leadType: ChatCapturedFields["leadType"]): LoanProgram {
  return leadType === "refinance" ? "REFI" : "CONVENTIONAL";
}

function inferLeadQuality(score: number | undefined): LeadQuality {
  if (score === undefined) return "developing";
  if (score >= 80) return "prime";
  if (score >= 60) return "strong";
  if (score >= 35) return "developing";
  return "watch";
}

/**
 * Hands a qualified lead_qualification session off into the same deterministic
 * borrower-lead / CRM store the manual intake flow uses, so an MLO sees it
 * alongside every other lead. Chat-captured fields don't map to the full
 * intake questionnaire, so this builds a minimal snapshot from only what the
 * chat actually captured (name/email/phone/leadType/urgency/summary/score)
 * rather than fabricating financial specifics the model never asked about.
 * No-ops if the session isn't qualified yet, or already has a linked lead —
 * never creates a second borrower/CRM lead for the same session.
 */
export function linkQualifiedLead(session: ChatSessionRecord): void {
  if (session.status !== "qualified") return;
  if (session.borrowerLeadId || session.crmLeadId) return;

  const f = session.capturedFields;
  const answers: BorrowerAnswers = {
    loanProgram: inferLoanProgram(f.leadType),
    name: f.name,
    email: f.email,
    phone: f.phone,
    contactConsent: f.consent,
    purchaseRefiIntent:
      f.leadType === "refinance" ? "refinance" : f.leadType === "buyer" ? "purchase" : "unsure",
  };

  const qualification: QualificationSummary = {
    programScores: { overallScore: session.leadScore },
    leadQuality: inferLeadQuality(session.leadScore),
    urgency: f.urgency ?? "standard",
    recommendedNextStep:
      session.recommendedAction ?? "Follow up with the lead captured via the AI assistant.",
    rationale: [session.summary ?? "Captured via the app.ypnus.com lead-qualification assistant."],
  };

  const assignedLoId = routeLoanOfficer(answers.loanProgram).id;
  const result = logCrmActivity(answers, qualification, assignedLoId, session.funnelSource, session.id);

  session.borrowerLeadId = result.borrowerLeadId;
  session.crmLeadId = result.crmLeadId;
}

const AUTOPILOT_TRIGGERS: RegExp[] = [
  /improve my website/i,
  /improve my profile/i,
  /landing page better/i,
  /get me more leads/i,
  /website\s*\/?\s*profile/i,
];

function matchesAutopilotTrigger(message: string): boolean {
  return AUTOPILOT_TRIGGERS.some((re) => re.test(message));
}

const AUTOPILOT_OPERATOR_STATEMENT =
  "I can prepare and apply safe YPNUS-controlled improvements for you, then show you what changed. Risky or compliance-sensitive updates will be held for review.";

/**
 * Runs the Website/Profile Autopilot for an mlo_dashboard session that asked
 * for help improving its website/profile — acting as an operator (it applies
 * safe changes itself) rather than just listing advice. Deterministic and
 * provider-independent, so it works even without an AI provider configured.
 */
function runAutopilotTurn(session: ChatSessionRecord, input: AssistantTurnInput): AssistantTurnResult {
  const plan: WebsiteAutopilotPlan = runWebsiteAutopilot({
    userId: input.userId,
    pageType: "profile",
    leadGoal: "all",
  });

  const reply = `${AUTOPILOT_OPERATOR_STATEMENT} ${plan.summaryForMlo}`;
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
    borrowerLeadId: session.borrowerLeadId,
    crmLeadId: session.crmLeadId,
    providerConfigured: getAiProvider() !== null,
    autopilot: {
      summaryForMlo: plan.summaryForMlo,
      autoAppliedCount: plan.autoAppliedCount,
      needsApprovalCount: plan.needsApprovalCount,
      dryRun: true,
      topChanges: plan.changes
        .slice(0, 5)
        .map((c) => ({ title: c.title, status: c.status, riskLevel: c.riskLevel, expectedBenefit: c.expectedBenefit })),
    },
  };
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

  if (input.mode === "mlo_dashboard" && matchesAutopilotTrigger(userMessage)) {
    return runAutopilotTurn(session, input);
  }

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
      borrowerLeadId: session.borrowerLeadId,
      crmLeadId: session.crmLeadId,
      providerConfigured: false,
    };
  }

  const system = buildSystemPrompt(input.mode);
  const history = session.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let reply: string;
  let handoffPhone: string | undefined;
  try {
    const { text, actionCalls } = await runWithTools(
      provider,
      system,
      history,
      toolsForMode(input.mode),
      session,
      (call) => {
        mergeCapturedFields(session, call.input as LeadQualificationToolInput);
        // Link as soon as qualification completes (not just at the end of the
        // turn) so a schedule_meeting call later in the same turn sees a
        // linked session immediately — see runWithTools's doc comment.
        try {
          linkQualifiedLead(session);
        } catch (error) {
          console.error("[chat-agent] linkQualifiedLead (mid-turn) failed", error);
        }
      },
    );

    reply = text.trim() || "Got it — one moment.";
    if (actionCalls.some((call) => call.toolName === "request_human_handoff")) {
      handoffPhone = resolveHandoffPhone();
    }
  } catch (error) {
    console.error("[chat-agent] provider.generate failed", error);
    reply = describeProviderError(error);
  }

  try {
    linkQualifiedLead(session);
  } catch (error) {
    console.error("[chat-agent] linkQualifiedLead failed", error);
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
    borrowerLeadId: session.borrowerLeadId,
    crmLeadId: session.crmLeadId,
    providerConfigured: true,
    ...(handoffPhone ? { handoffRequested: true, handoffPhone } : {}),
  };
}
