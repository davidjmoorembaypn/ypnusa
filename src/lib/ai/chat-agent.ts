import Anthropic from "@anthropic-ai/sdk";
import { generateId } from "@/lib/id";
import { bookAppointment, listSyncedAvailableSlots } from "@/lib/calendar";
import { readAgentOnboarding, readChatSession, readDb, saveChatSession, writeDb } from "@/lib/db";
import { normalizeEmail } from "@/lib/accounts";
import { findZipOwnerSubscription, HOUSE_OFFICER_ID, logCrmActivity, routeLead } from "@/lib/crm";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { emailNewLeadAlert, notifyAssignedOfficer } from "@/lib/notifications";
import { marketingUrl } from "@/lib/site";
import { FREE_SIGNUP_HREF } from "@/lib/checkout";
import { FREE_VISITOR_DAILY_MESSAGES } from "@/lib/free-tier";
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
import { isPricingTierId, PUBLIC_PRICING_TIERS } from "@/lib/pricing";
import { checkoutUrlForTier } from "@/lib/checkout";
import { executeMloTool, MLO_TOOL_NAMES, MLO_TOOLS, type MloToolContext } from "./cerebro-tools";
import { findExplainerVideo } from "./explainer-videos";
import {
  BORROWER_FOLLOW_UP_TOOL_NAMES,
  executeSavePrequalDetails,
  executeSubscribeRateAlerts,
  SAVE_PREQUAL_DETAILS_TOOL,
  SUBSCRIBE_RATE_ALERTS_TOOL,
} from "./follow-up-tools";
import {
  CREATE_STARTER_KIT_TOOL,
  executeCreateStarterKit,
  executeRequestCallback,
  executeSaveOfficerProspect,
  PUBLIC_ACTION_TOOL_NAMES,
  REQUEST_CALLBACK_TOOL,
  SAVE_OFFICER_PROSPECT_TOOL,
} from "./public-agent-tools";
import { executeKnowledgeTool, MORTGAGE_GUIDE_TOOL, PLATFORM_HELP_TOOL } from "./knowledge";
import { type AiMessage, type AiProvider, type AiToolCall, type AiToolDefinition, getAiProvider } from "./provider";
import {
  buildSystemPrompt,
  CAPTURE_LEAD_QUALIFICATION_TOOL,
  CHECK_TERRITORY_AVAILABILITY_TOOL,
  FIND_EXPLAINER_VIDEO_TOOL,
  GET_PRICING_TOOL,
  REQUEST_HUMAN_HANDOFF_TOOL,
  SCHEDULE_MEETING_TOOL,
  START_SIGNUP_TOOL,
  type LeadQualificationToolInput,
} from "./prompts";
import { generateWebsiteAutopilotPlan, runWebsiteAutopilot, type WebsiteAutopilotPlan } from "./website-autopilot";
import { alertOfficerOfNewChat } from "@/lib/push-alerts";
import { queueLeadForOfficer } from "@/lib/integrations/crm/link";
import {
  appendBorrowerMessageIfTakenOver,
  chatHandlerFirstName,
  officerChatContext,
  officerChatPrompt,
  officerLicensedFor,
  reconcileWithStored,
} from "@/lib/live-chat";

/** Modes where the assistant talks to a prospective customer, not an MLO about their own pipeline. */
const CUSTOMER_FACING_MODES: AssistantMode[] = ["public_site", "lead_qualification"];

export function toolsForMode(mode: AssistantMode): AiToolDefinition[] {
  const tools: AiToolDefinition[] = [FIND_EXPLAINER_VIDEO_TOOL];
  if (mode === "lead_qualification") {
    tools.push(
      CAPTURE_LEAD_QUALIFICATION_TOOL,
      SCHEDULE_MEETING_TOOL,
      REQUEST_CALLBACK_TOOL,
      SAVE_PREQUAL_DETAILS_TOOL,
      SUBSCRIBE_RATE_ALERTS_TOOL,
      REQUEST_HUMAN_HANDOFF_TOOL,
    );
  }
  if (mode === "public_site") {
    // Cerebro greets everyone: loan officers get signup/pricing, consumers get qualified in place.
    tools.push(
      START_SIGNUP_TOOL,
      GET_PRICING_TOOL,
      CREATE_STARTER_KIT_TOOL,
      SAVE_OFFICER_PROSPECT_TOOL,
      CAPTURE_LEAD_QUALIFICATION_TOOL,
      SCHEDULE_MEETING_TOOL,
      REQUEST_CALLBACK_TOOL,
      SAVE_PREQUAL_DETAILS_TOOL,
      SUBSCRIBE_RATE_ALERTS_TOOL,
      REQUEST_HUMAN_HANDOFF_TOOL,
    );
  }
  // Signed-in officers can check ZIP codes (their own is recognised as theirs) and plans too.
  if (mode === "mlo_dashboard") tools.push(...MLO_TOOLS, CHECK_TERRITORY_AVAILABILITY_TOOL, GET_PRICING_TOOL);
  if (CUSTOMER_FACING_MODES.includes(mode)) tools.push(CHECK_TERRITORY_AVAILABILITY_TOOL);
  // Answer books: how YPN USA works (officers, and officers shopping on the site); home-loan basics (borrowers).
  if (mode === "mlo_dashboard" || mode === "public_site") tools.push(PLATFORM_HELP_TOOL);
  if (CUSTOMER_FACING_MODES.includes(mode)) tools.push(MORTGAGE_GUIDE_TOOL);
  return tools;
}

function signupUrl(input: { plan?: unknown; zip?: unknown }): string {
  const plan = isPricingTierId(input.plan) ? input.plan : "free";
  const zip = typeof input.zip === "string" && input.zip.trim() ? input.zip.trim() : undefined;
  const href = checkoutUrlForTier(plan, zip);
  // Relative app paths (the free sign-in) become absolute so the link works anywhere.
  return href.startsWith("/") ? marketingUrl(href) : href;
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

/**
 * The lock rule every ZIP code answer must reflect: a ZIP code locks only at the first real
 * payment. Free never locks it, and the 15-day trial lets someone try the tools without
 * locking it — whoever pays first gets it.
 */
export const ZIP_LOCK_NOTE =
  "A ZIP code locks to a loan officer only when their first payment goes through. A free account never reserves it, and the 15-day trial lets them try the tools but does not lock it — whoever pays first gets the ZIP code.";

/** Suggested wording for an open ZIP code (owner-approved). */
export const OPEN_ZIP_REPLY_HINT =
  "It's open now. It locks to you once your first payment goes through — pay now to lock it today, or start the 15-day trial to try the tools first.";

/**
 * Plan facts beyond the monthly list in pricing.ts, as the owner set them. Text only: the
 * links live on /pricing (pay-now and prepaid checkout URLs belong to checkout.ts).
 * TODO: read the prepaid prices from pricing.ts once its PREPAID_5Y data lands.
 */
export const PRICING_POLICY = {
  zipLock: ZIP_LOCK_NOTE,
  payNow:
    "Pay now & lock my ZIP code today: no trial, same monthly prices (Pro $99, Growth $199, Exclusive $299). The ZIP code locks as soon as the payment goes through.",
  prepaid5Year:
    "5-year prepaid, one-time payment: Pro $3,999, Growth $7,999, Exclusive $11,999 (about a third off paying monthly). The ZIP code is locked for 5 years from payment. Full refund within 30 days of purchase, no refunds after that; a refund releases the ZIP code.",
  trial: "15-day trial: try the tools first. The trial does not lock the ZIP code.",
  value:
    "Illustration only, never a promise: one extra closed loan pays for YPN many times over. The payback calculator on the pricing page lets them run their own numbers.",
} as const;

/**
 * check_territory_availability. Adds the lock rule and the Pro checkout / pricing links to
 * an open ZIP code, and recognises a ZIP code the signed-in officer already holds.
 */
async function executeTerritoryCheck(zip: string, viewerEmail?: string): Promise<string> {
  const result = await fetchLiveTerritory(zip);
  if (!result) return JSON.stringify({ error: "Territory lookup is temporarily unavailable." });
  if (!result.valid) return JSON.stringify({ available: false, message: result.message });

  const viewer = normalizeEmail(viewerEmail);
  const owner = viewer ? findZipOwnerSubscription(result.zip) : null;
  if (viewer && owner && normalizeEmail(owner.ownerEmail) === viewer) {
    return JSON.stringify({
      available: false,
      ownedByYou: true,
      message: `ZIP code ${result.zip} is your exclusive territory. Leads from it route to you.`,
    });
  }
  if (!result.available) return JSON.stringify({ available: false, message: result.message });

  return JSON.stringify({
    available: true,
    message: result.message,
    lockNote: ZIP_LOCK_NOTE,
    suggestedReply: OPEN_ZIP_REPLY_HINT,
    payNowOption: PRICING_POLICY.payNow,
    // Pro signup for this ZIP code; /pricing has pay-now, trial and 5-year prepaid options.
    lockCheckoutUrl: signupUrl({ plan: "growth", zip: result.zip }),
    pricingUrl: marketingUrl("/pricing"),
  });
}

/** Tools that show a public chat is a loan officer's (counts toward the visitor cap). */
const OFFICER_SIGNAL_TOOLS = new Set(["create_starter_kit", "save_officer_prospect", "start_signup", "get_pricing"]);
/** Tools that show a public chat is a homebuyer's or homeowner's (never capped). */
const BORROWER_SIGNAL_TOOLS = new Set([
  "capture_lead_qualification",
  "schedule_meeting",
  "request_callback",
  "save_prequal_details",
  "subscribe_rate_alerts",
]);

/** A borrower signal always wins: once a chat is a homebuyer's it is never capped. */
export function noteAudience(session: ChatSessionRecord, toolName: string): void {
  if (BORROWER_SIGNAL_TOOLS.has(toolName)) session.audience = "borrower";
  else if (OFFICER_SIGNAL_TOOLS.has(toolName) && session.audience !== "borrower") session.audience = "officer";
}

/** Runs one real-world action tool and returns a plain-text result for the model. Never throws. */
async function executeActionTool(
  call: AiToolCall,
  session: ChatSessionRecord,
  ctx: MloToolContext = {},
): Promise<string> {
  try {
    if (session.mode === "public_site") noteAudience(session, call.toolName);
    if (MLO_TOOL_NAMES.has(call.toolName)) {
      // Only a signed-in officer's own session may run these; a public session never can.
      if (session.mode !== "mlo_dashboard") return JSON.stringify({ error: "not_available" });
      return await executeMloTool(call, ctx);
    }
    if (BORROWER_FOLLOW_UP_TOOL_NAMES.has(call.toolName)) {
      if (!CUSTOMER_FACING_MODES.includes(session.mode)) return JSON.stringify({ error: "not_available" });
      return call.toolName === "subscribe_rate_alerts"
        ? executeSubscribeRateAlerts(call, session)
        : executeSavePrequalDetails(call, session);
    }
    if (PUBLIC_ACTION_TOOL_NAMES.has(call.toolName)) {
      if (call.toolName === "request_callback") {
        if (!CUSTOMER_FACING_MODES.includes(session.mode)) return JSON.stringify({ error: "not_available" });
        return executeRequestCallback(call, session);
      }
      // Officer-acquisition tools belong to the public site only.
      if (session.mode !== "public_site") return JSON.stringify({ error: "not_available" });
      return call.toolName === "create_starter_kit"
        ? executeCreateStarterKit(call, session)
        : executeSaveOfficerProspect(call, session);
    }
    if (call.toolName === "check_territory_availability") {
      const zip = typeof call.input.zip === "string" ? call.input.zip : "";
      return await executeTerritoryCheck(zip, session.mode === "mlo_dashboard" ? ctx.userEmail : undefined);
    }
    if (call.toolName === "platform_help" || call.toolName === "mortgage_guide") {
      return executeKnowledgeTool(call.toolName, call.input.question);
    }
    if (call.toolName === "find_explainer_video") {
      const topic = typeof call.input.topic === "string" ? call.input.topic : "";
      const video = findExplainerVideo(topic);
      return video
        ? JSON.stringify({ title: video.title, url: video.url, description: video.description })
        : JSON.stringify({ found: false, note: "No explainer video covers this topic yet." });
    }
    if (call.toolName === "get_pricing") {
      return JSON.stringify({
        plans: PUBLIC_PRICING_TIERS.map((tier) => ({
          name: tier.name,
          price: tier.price,
          cadence: tier.cadence,
          includedZips: tier.zipCapacityLabel,
          trialDays: tier.trialDays,
          tagline: tier.tagline,
          features: tier.features,
        })),
        policy: PRICING_POLICY,
        pricingUrl: marketingUrl("/pricing"),
      });
    }
    if (call.toolName === "start_signup") {
      const plan = isPricingTierId(call.input.plan) ? call.input.plan : "free";
      if (plan !== "free") return JSON.stringify({ url: signupUrl(call.input) });
      // A free signup never reserves a ZIP code, so the free link carries none, and the model
      // gets the lock rule plus the Pro checkout link to offer alongside it.
      const zip = typeof call.input.zip === "string" && call.input.zip.trim() ? call.input.zip.trim() : undefined;
      return JSON.stringify({
        url: signupUrl({ plan: "free" }),
        lockNote: ZIP_LOCK_NOTE,
        lockCheckoutUrl: signupUrl({ plan: "growth", zip }),
      });
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

const MAX_TOOL_ROUNDS = 5;
/**
 * Wall-clock budget for one whole turn (every model round plus tool runs). Apache's
 * ProxyTimeout in front of app.ypnus.com is 60s; staying under ~50s leaves room for the
 * route itself so the visitor gets an answer instead of a proxy error page.
 */
export const TURN_BUDGET_MS = 50_000;
/** Per-call ceiling (matches the SDK client timeout in anthropic-provider.ts). */
const MAX_CALL_MS = 45_000;
/** Below this much budget left, don't start another model round. */
const MIN_ROUND_MS = 5_000;
const OUT_OF_TIME_REPLY =
  "That took longer than expected on my end. Please send your message again, or ask me something a little narrower.";

/**
 * Wraps one tool result in a clearly delimited envelope. Tool output can include text that
 * came from third parties (lead notes, page copy, lookups), so it is labelled as untrusted
 * data and the system prompt (TOOL_DATA_SAFETY_RULE) tells the model never to follow
 * instructions inside it. A result that tries to close the envelope early is defused.
 */
export function wrapToolData(toolName: string, output: string): string {
  const safeName = toolName.replace(/[^a-z0-9_]/gi, "");
  const safeOutput = output.replace(/<\s*\/?\s*tool_data/gi, "[tool_data");
  return `<tool_data tool="${safeName}" trust="untrusted">\n${safeOutput}\n</tool_data>`;
}

const ACTION_TOOL_NAMES = new Set([
  "check_territory_availability",
  // get_pricing was missing here, so a "what do the plans cost?" question ended the turn on the
  // model's "let me pull that up" preface without ever running the tool.
  "get_pricing",
  "find_explainer_video",
  "start_signup",
  "schedule_meeting",
  "request_human_handoff",
  ...PUBLIC_ACTION_TOOL_NAMES,
  ...BORROWER_FOLLOW_UP_TOOL_NAMES,
  ...MLO_TOOL_NAMES,
  "platform_help",
  "mortgage_guide",
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
  ctx: MloToolContext = {},
  options: { budgetMs?: number; maxTokens?: number } = {},
): Promise<{ text: string; captureCalls: AiToolCall[]; actionCalls: AiToolCall[] }> {
  const messages = [...history];
  const captureCalls: AiToolCall[] = [];
  const allActionCalls: AiToolCall[] = [];
  const deadline = Date.now() + (options.budgetMs ?? TURN_BUDGET_MS);
  const remaining = () => deadline - Date.now();
  /** Text the model already wrote this turn - shown if the budget runs out before a final answer. */
  let lastText = "";
  /** Set after a tool-only round: the next call goes out without tools so the model must write text. */
  let textOnly = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (remaining() < MIN_ROUND_MS) {
      return { text: lastText || OUT_OF_TIME_REPLY, captureCalls, actionCalls: allActionCalls };
    }
    const result = await provider.generate({
      system,
      messages,
      tools,
      // Gemini tends to answer a "now write your reply" nudge with the same tool call again (or an
      // empty reply when the tool is missing), which left visitors with "Got it — one moment."
      // toolChoice none keeps the tools declared but makes it write text.
      ...(textOnly ? { toolChoice: "none" as const } : {}),
      timeoutMs: Math.min(MAX_CALL_MS, remaining()),
      ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
    });
    if (result.text.trim()) lastText = result.text.trim();
    for (const call of result.toolCalls) {
      if (call.toolName === "capture_lead_qualification") {
        captureCalls.push(call);
        mergeCapture(call);
      }
    }

    const actionCalls = result.toolCalls.filter((call) => ACTION_TOOL_NAMES.has(call.toolName));
    if (actionCalls.length === 0) {
      // A tool-only turn (typically capture_lead_qualification with no text) would show the
      // visitor nothing. Ask once for the reply in plain text instead of returning "".
      if (!result.text.trim() && result.toolCalls.length > 0 && round < MAX_TOOL_ROUNDS - 1) {
        messages.push({
          role: "user",
          content: "[note] Your tool call was recorded. Now write your reply to the visitor in plain text.",
        });
        textOnly = true;
        continue;
      }
      return { text: result.text, captureCalls, actionCalls: allActionCalls };
    }
    allActionCalls.push(...actionCalls);

    if (result.text.trim()) messages.push({ role: "assistant", content: result.text.trim() });
    const toolOutputs = await Promise.all(
      actionCalls.map(async (call) => wrapToolData(call.toolName, await executeActionTool(call, session, ctx))),
    );
    messages.push({ role: "user", content: toolOutputs.join("\n") });
  }

  // Ran out of rounds — ask once more without tools so the model must answer in text.
  if (remaining() < MIN_ROUND_MS) {
    return { text: lastText || OUT_OF_TIME_REPLY, captureCalls, actionCalls: allActionCalls };
  }
  const final = await provider.generate({ system, messages, timeoutMs: Math.min(MAX_CALL_MS, remaining()) });
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
  /** Signed-in session email - lets MLO tools find the officer's own record. Never taken from the client. */
  userEmail?: string;
  /** True when the signed-in user has an active paid plan (or is an admin) — sets the daily message cap. */
  paidPlan?: boolean;
  funnelSource?: string;
  /** Slug of the loan officer page the borrower is chatting on (lead_qualification only). */
  officerSlug?: string;
  /** public_site only: hashed network address for the Free visitor cap (src/lib/free-tier.ts). Never the raw address. */
  visitorKey?: string;
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
  /** Set when the signed-in user hit the daily message cap; the model was not called. */
  limitReached?: boolean;
  /** True while the loan officer has taken over this chat: Cerebro stayed silent and reply is empty. */
  humanMode?: boolean;
  /** With humanMode: first name of the officer handling the chat now. */
  handlerName?: string;
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
    ...(input.mode === "public_site" && input.visitorKey ? { visitorKey: input.visitorKey } : {}),
    ...officerFieldsFor(input),
    messages: [],
    capturedFields: {},
    status: "active",
  };
}

/** Ties a new borrower chat to the officer whose page it started on, when that page is live. */
function officerFieldsFor(input: AssistantTurnInput): Pick<ChatSessionRecord, "officerUserId" | "officerSlug"> {
  if (input.mode !== "lead_qualification" || !input.officerSlug) return {};
  const officer = officerChatContext(input.officerSlug);
  return officer ? { officerUserId: officer.userId, officerSlug: officer.slug } : {};
}

function systemPromptFor(session: ChatSessionRecord): string {
  const base = buildSystemPrompt(session.mode);
  if (session.mode !== "lead_qualification" || !session.officerSlug) return base;
  const officer = officerChatContext(session.officerSlug);
  return officer ? `${base}\n\n${officerChatPrompt(officer)}` : base;
}

function humanModeResult(session: ChatSessionRecord): AssistantTurnResult {
  return {
    sessionId: session.id,
    reply: "",
    capturedFields: session.capturedFields,
    status: session.status,
    borrowerLeadId: session.borrowerLeadId,
    crmLeadId: session.crmLeadId,
    providerConfigured: getAiProvider() !== null,
    humanMode: true,
    handlerName: chatHandlerFirstName(session),
  };
}

/**
 * The saved transcript for one chat session, for re-rendering after a reload. Dashboard
 * sessions are returned only to the user who owns them; anything else yields [].
 */
export function transcriptForSession(input: {
  sessionId: string;
  mode: AssistantMode;
  userId?: string;
}): Array<{ role: ChatMessageRecord["role"]; content: string; author?: "officer"; authorName?: string }> {
  const session = readChatSession(input.sessionId);
  if (!session || session.mode !== input.mode) return [];
  if (input.mode === "mlo_dashboard" && (!input.userId || session.userId !== input.userId)) return [];
  return session.messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.author ? { author: message.author } : {}),
    ...(message.author && message.authorName ? { authorName: message.authorName } : {}),
  }));
}

/** First name of the officer handling a borrower chat now, for the borrower's chat window. */
export function chatHandlerName(sessionId: string): string | undefined {
  const session = readChatSession(sessionId);
  return session?.mode === "lead_qualification" ? chatHandlerFirstName(session) : undefined;
}

/** Whether the loan officer is answering a borrower chat right now (Live Takeover). */
export function chatHandledBy(sessionId: string): "ai" | "officer" {
  const session = readChatSession(sessionId);
  return session?.mode === "lead_qualification" && session.handledBy === "officer" ? "officer" : "ai";
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
  if (input.zip !== undefined) {
    const zip = normalizeZip(input.zip);
    if (isValidZip(zip)) next.zip = zip;
  }
  const zipChanged = next.zip !== undefined && next.zip !== session.capturedFields.zip;
  const stateChanged = next.state !== undefined && next.state !== session.capturedFields.state;
  session.capturedFields = next;
  if (zipChanged || stateChanged) rerouteLinkedLead(session);

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

/**
 * Location given after the lead was already linked:
 * - a house lead moves to the ZIP code's paying loan officer;
 * - a lead given to the page's officer moves to normal routing when that officer turns out not
 *   to be licensed in the borrower's state.
 * Never moves a lead away from a paying officer for any other reason, and never re-sends any alert.
 * A moved lead is sent once to the new officer's CRM link, if they have one.
 */
function rerouteLinkedLead(session: ChatSessionRecord): void {
  const leadId = session.borrowerLeadId;
  const zip = session.capturedFields.zip;
  if (!leadId) return;
  const lead = readDb().borrowerLeads.find((item) => item.id === leadId);
  if (!lead) return;
  let route: ReturnType<typeof routeLead> | null = null;
  let note = "";
  if (lead.assignedLoId === HOUSE_OFFICER_ID && zip) {
    const zipRoute = routeLead({ program: lead.answers.loanProgram, zip });
    if (zipRoute.reason === "zip_owner") {
      route = zipRoute;
      note = `Cerebro: borrower gave ZIP code ${zip}; lead moved to its loan officer.`;
    }
  } else if (session.officerSlug && session.officerUserId && lead.assignedLoId === session.officerUserId) {
    const pageOfficer = officerChatContext(session.officerSlug);
    const location = { zip, state: session.capturedFields.state };
    if (pageOfficer && !officerLicensedFor(pageOfficer, location)) {
      const licensedRoute = routeLead({ program: lead.answers.loanProgram, zip });
      if (licensedRoute.officer.id !== lead.assignedLoId) {
        route = licensedRoute;
        note = "Cerebro: the property is outside this officer's licensed states; lead moved to a licensed loan officer.";
      }
    }
  }
  if (!route) return;
  writeDb((db) => {
    const officerId = route.officer.id;
    const stored = db.borrowerLeads.find((item) => item.id === leadId);
    if (stored) {
      stored.assignedLoId = officerId;
      if (zip) stored.answers = { ...stored.answers, zip };
    }
    const crm = db.crmLeads.find((item) => item.borrowerLeadId === leadId);
    if (crm) {
      crm.assignedLoId = officerId;
      crm.notes.push(note);
    }
    for (const action of db.cerebroActions) {
      if (action.borrowerLeadId === leadId && action.status === "awaiting_approval") action.loId = officerId;
    }
  });
  // The new officer's CRM gets the lead too (their alerts were already covered by the first one).
  queueLeadForOfficer(route.officer.id, leadId);
}

/**
 * Used only when the model returned no text at all. Instead of a dead-end "one moment", asks for
 * the next missing piece of a borrower's details (or offers help), so the chat keeps moving.
 */
export function fallbackReply(session: ChatSessionRecord): string {
  if (!CUSTOMER_FACING_MODES.includes(session.mode)) return "Done. What would you like to do next?";
  const f = session.capturedFields;
  if (!f.leadType) {
    return "Happy to help. Are you a loan officer, or are you buying, selling or refinancing a home?";
  }
  if (f.leadType === "other") return "Thanks. What can I help you with today?";
  if (!f.zip) return "Thanks! What's the ZIP code of the home, or the area you're looking in?";
  if (!f.name) return "Got it. What's your name?";
  if (!f.email && !f.phone) return "Thanks. What's the best email or phone number to reach you?";
  if (f.consent !== true) {
    return "May a local loan officer contact you by phone, text or email about this? You can say no.";
  }
  return "Thanks, you're all set. A local loan officer will reach out. Is there anything else I can help with?";
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
    zip: f.zip,
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

  // Routes to the paying loan officer who holds the borrower's ZIP code, or the house book.
  // A chat on an officer's own page goes to that officer, unless the property is in a state
  // they aren't licensed in (then the usual ZIP code routing picks a licensed officer).
  const pageOfficer = session.officerSlug ? officerChatContext(session.officerSlug) : null;
  const officerSlug =
    pageOfficer && officerLicensedFor(pageOfficer, { zip: f.zip, state: f.state }) ? pageOfficer.slug : undefined;
  const route = routeLead({ program: answers.loanProgram, zip: answers.zip, officerSlug });
  const result = logCrmActivity(answers, qualification, route.officer.id, session.funnelSource, session.id);

  session.borrowerLeadId = result.borrowerLeadId;
  session.crmLeadId = result.crmLeadId;

  notifyAssignedOfficer({
    loId: route.officer.id,
    borrowerLeadId: result.borrowerLeadId,
    loanProgram: answers.loanProgram,
    answers,
    qualification,
  });
  void emailNewLeadAlert({
    officer: route.officer,
    routeReason: route.reason,
    borrowerLeadId: result.borrowerLeadId,
    loanProgram: answers.loanProgram,
    answers,
    qualification,
  });
}

/**
 * Only an explicit command runs the autopilot without the model ("run website autopilot",
 * "start the autopilot"). Looser phrases such as "get me more leads" used to match too,
 * skipping the model and creating a batch of generic change records every time; those now
 * go to the model, which can call run_website_autopilot itself when it fits.
 */
const AUTOPILOT_COMMAND = /^\s*(please\s+)?(run|start)\s+(the\s+|my\s+)?(website\s+)?autopilot\b/i;

export function matchesAutopilotCommand(message: string): boolean {
  return AUTOPILOT_COMMAND.test(message);
}

/**
 * Runs the Website/Profile Autopilot for an mlo_dashboard session that explicitly asked for
 * it. Deterministic and provider-independent, so it works even without an AI provider. It
 * only drafts changes (deduplicated in runWebsiteAutopilot); nothing is published here.
 */
function runAutopilotTurn(session: ChatSessionRecord, input: AssistantTurnInput): AssistantTurnResult {
  // Free plan: the same check as a preview, saved and applied nowhere (src/lib/free-tier.ts).
  const preview = input.paidPlan !== true;
  const plan: WebsiteAutopilotPlan = preview
    ? generateWebsiteAutopilotPlan({ userId: input.userId, pageType: "profile", leadGoal: "all" })
    : runWebsiteAutopilot({
        userId: input.userId,
        pageType: "profile",
        leadGoal: "all",
        autonomy: input.userId ? readAgentOnboarding(input.userId)?.autonomy : undefined,
      });

  const reply = preview ? autopilotPreviewReply(plan) : plan.summaryForMlo;
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
      summaryForMlo: preview ? reply : plan.summaryForMlo,
      autoAppliedCount: preview ? 0 : plan.autoAppliedCount,
      needsApprovalCount: preview ? 0 : plan.needsApprovalCount,
      dryRun: true,
      topChanges: plan.changes
        .slice(0, 5)
        .map((c) => ({ title: c.title, status: c.status, riskLevel: c.riskLevel, expectedBenefit: c.expectedBenefit })),
    },
  };
}

/** What a Free-plan autopilot run shows: the changes Cerebro would make, none applied. */
export function autopilotPreviewReply(plan: WebsiteAutopilotPlan): string {
  const lines = plan.changes.slice(0, 5).map((change) => `- ${change.title}`);
  if (lines.length === 0) {
    return `Autopilot preview: your page looks good right now. On a paid plan Cerebro keeps checking it and applies improvements for you: ${marketingUrl("/pricing")}`;
  }
  return [
    `Autopilot preview: here's what I'd change on your page.`,
    ...lines,
    "",
    `Nothing was changed: on the Free plan this is a preview. A paid plan has me apply these and keep your page improving on autopilot: ${marketingUrl("/pricing")}`,
  ].join("\n");
}

/**
 * Never surfaces a provider's raw error text (billing balances, key problems, request ids) to a
 * visitor. The detail is already in the server log via console.error at the call site.
 */
function describeProviderError(error: unknown, mode: AssistantMode): string {
  if (mode === "mlo_dashboard") {
    if (error instanceof Anthropic.RateLimitError) {
      return "I'm handling a lot of requests right now. Give me a minute and send that again.";
    }
    return "I couldn't finish that just now. Your message is saved — please try again in a minute. If it keeps happening, email support@ypnus.com and we'll sort it out.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "I'm getting a lot of requests right now — please try again in a moment.";
  }
  return "Sorry, I'm having trouble connecting right now, and your message has been saved. You can book a free consultation at /consultation, or try again in a minute.";
}

/** Daily cap on model-answered dashboard messages per signed-in user (cost guard). */
export const PAID_DAILY_MESSAGE_LIMIT = 200;
/** Free plan: a taste of Cerebro, not the whole thing (src/lib/free-tier.ts). Was 30 before Nov 2026. */
export const FREE_DAILY_MESSAGE_LIMIT = 15;

export function dailyMessageLimit(paidPlan: boolean): number {
  return paidPlan ? PAID_DAILY_MESSAGE_LIMIT : FREE_DAILY_MESSAGE_LIMIT;
}

function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Model-answered mlo_dashboard messages this user has sent today, across all their sessions. */
export function countUserMessagesToday(userId: string, now: Date = new Date()): number {
  const today = utcDay(now);
  return readDb()
    .chatSessions.filter(
      (session) => session.mode === "mlo_dashboard" && session.userId === userId && session.usageDay === today,
    )
    .reduce((total, session) => total + (session.usageCount ?? 0), 0);
}

/**
 * Model-answered messages today in this device's loan-officer chats on the public site
 * (homebuyer chats and chats with no signal yet are not counted).
 */
export function countVisitorOfficerMessagesToday(visitorKey: string, now: Date = new Date()): number {
  const today = utcDay(now);
  return readDb()
    .chatSessions.filter(
      (session) =>
        session.mode === "public_site" &&
        session.visitorKey === visitorKey &&
        session.audience === "officer" &&
        session.usageDay === today,
    )
    .reduce((total, session) => total + (session.usageCount ?? 0), 0);
}

function recordModelUsage(session: ChatSessionRecord): void {
  const today = utcDay();
  if (session.usageDay !== today) {
    session.usageDay = today;
    session.usageCount = 0;
  }
  session.usageCount = (session.usageCount ?? 0) + 1;
}

/** How many recent messages are sent to the model each turn (the full transcript stays saved). */
export const MODEL_HISTORY_LIMIT = 20;

/**
 * The last MODEL_HISTORY_LIMIT messages, starting on a user message (the Messages API
 * expects the conversation to open with the user).
 */
export function trimHistoryForModel(messages: ChatMessageRecord[]): AiMessage[] {
  const recent = messages.slice(-MODEL_HISTORY_LIMIT);
  const firstUser = recent.findIndex((message) => message.role === "user");
  return (firstUser === -1 ? [] : recent.slice(firstUser)).map((message) => ({
    role: message.role,
    content: message.content,
  }));
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
  if (session.mode === "lead_qualification" && session.handledBy === "officer") {
    // Live Takeover: the loan officer answers this chat, so Cerebro stays silent.
    const stored = appendBorrowerMessageIfTakenOver(session.id, userMessage);
    if (stored) return humanModeResult(stored);
  }
  appendMessage(session, "user", userMessage);
  if (session.officerUserId && session.messages.filter((message) => message.role === "user").length === 1) {
    alertOfficerOfNewChat(session.officerUserId, session.id);
  }

  if (input.mode === "mlo_dashboard" && matchesAutopilotCommand(userMessage)) {
    return runAutopilotTurn(session, input);
  }

  if (input.mode === "mlo_dashboard" && input.userId) {
    const limit = dailyMessageLimit(input.paidPlan === true);
    if (countUserMessagesToday(input.userId) >= limit) {
      const reply = input.paidPlan
        ? `You've reached today's limit of ${limit} Cerebro messages. It resets at midnight UTC — or email support@ypnus.com if you need more today.`
        : `You've used today's ${limit} free Cerebro messages. They reset at midnight UTC. A paid plan raises that to ${PAID_DAILY_MESSAGE_LIMIT} a day and is the only way to lock your ZIP code: ${marketingUrl("/pricing")}`;
      appendMessage(session, "assistant", reply);
      session.updatedAt = nowIso();
      saveChatSession(session);
      return {
        sessionId: session.id,
        reply,
        capturedFields: session.capturedFields,
        status: session.status,
        providerConfigured: getAiProvider() !== null,
        limitReached: true,
      };
    }
  }

  if (
    input.mode === "public_site" &&
    session.visitorKey &&
    session.audience !== "borrower" &&
    countVisitorOfficerMessagesToday(session.visitorKey) >= FREE_VISITOR_DAILY_MESSAGES
  ) {
    // Only reached once this device's loan-officer chats used today's free replies; homebuyers never are.
    const reply = `That's today's free Cerebro chat on the site. Create a free account to keep going (it adds more messages and one real Cerebro action a day): ${marketingUrl(FREE_SIGNUP_HREF)} Or see what a paid plan does on autopilot: ${marketingUrl("/pricing")}`;
    appendMessage(session, "assistant", reply);
    session.updatedAt = nowIso();
    saveChatSession(session);
    return {
      sessionId: session.id,
      reply,
      capturedFields: session.capturedFields,
      status: session.status,
      providerConfigured: getAiProvider() !== null,
      limitReached: true,
    };
  }

  const provider = getAiProvider();
  if (!provider) {
    // Once an AI provider key is set in the deployment environment this branch stops
    // firing automatically. The visitor-facing text never names keys or setup steps.
    console.warn("[chat-agent] no AI provider configured; returning the offline reply.");
    const reply =
      "Cerebro is offline for a moment. Your message has been saved — please try again shortly, or email support@ypnus.com if it's urgent.";
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

  const system = systemPromptFor(session);
  const history = trimHistoryForModel(session.messages);
  if (input.mode === "mlo_dashboard" || input.mode === "public_site") recordModelUsage(session);

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
      { userId: input.userId, userEmail: input.userEmail, paidPlan: input.paidPlan === true },
      // The starter kit is written inside one tool call, so public chats get a larger output cap.
      input.mode === "public_site" ? { maxTokens: 4096 } : {},
    );

    reply = text.trim() || fallbackReply(session);
    if (actionCalls.some((call) => call.toolName === "request_human_handoff")) {
      handoffPhone = resolveHandoffPhone();
    }
  } catch (error) {
    console.error("[chat-agent] provider.generate failed", error);
    reply = describeProviderError(error, input.mode);
  }

  try {
    linkQualifiedLead(session);
  } catch (error) {
    console.error("[chat-agent] linkQualifiedLead failed", error);
  }

  // The officer may have taken over while the model was answering: keep their takeover and
  // messages, and drop Cerebro's reply so the borrower only hears from the officer.
  if (session.mode === "lead_qualification" && reconcileWithStored(session)) {
    session.updatedAt = nowIso();
    saveChatSession(session);
    return humanModeResult(session);
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
