import { readDb, listWebsiteAutopilotChanges, readAgentOnboarding, saveAutopilotRun, saveWebsiteAutopilotChange } from "@/lib/db";
import { runAgent } from "@/lib/agents/coreAgent";
import type { PlatformChannel } from "@/lib/agents/marketingAgent";
import type { AutopilotPageType } from "@/lib/types";
import { getWordPressAutopilotStatus } from "@/lib/wordpress";
import type { AiToolCall, AiToolDefinition } from "./provider";
import {
  buildAutopilotRunRecord,
  runWebsiteAutopilot,
  type AutopilotAutonomy,
  type LeadGoal,
} from "./website-autopilot";

/**
 * Cerebro's toolset for a signed-in loan officer (mlo_dashboard mode). Every
 * executor is scoped to the caller's own userId/email - a tool never takes a
 * userId or leadId from the model, so a prompt-injected message cannot reach
 * another officer's data. Content tools only DRAFT; nothing here sends email or
 * SMS, or publishes to a live site.
 */

export interface MloToolContext {
  userId?: string;
  userEmail?: string;
}

export const MLO_TOOL_NAMES = new Set([
  "get_my_pipeline",
  "run_website_autopilot",
  "list_pending_website_changes",
  "decide_website_change",
  "draft_marketing_content",
  "draft_landing_page",
]);

export const GET_MY_PIPELINE_TOOL: AiToolDefinition = {
  name: "get_my_pipeline",
  description:
    "List the signed-in loan officer's own most recent leads (quality band, urgency, status, recommended next step). Use before advising on who to contact first.",
  inputSchema: {
    type: "object",
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 15, description: "How many recent leads to return. Default 8." },
    },
    additionalProperties: false,
  },
};

export const RUN_WEBSITE_AUTOPILOT_TOOL: AiToolDefinition = {
  name: "run_website_autopilot",
  description:
    "Improve the loan officer's website/profile for them: generates headline, CTA, chatbot greeting, form helper text, SEO title/meta and local-market copy, applies what the officer's autonomy setting allows, and holds anything touching rates, approvals, NMLS/license or other regulated language for their review. Call this when the officer asks you to improve, fix, or build their site/profile.",
  inputSchema: {
    type: "object",
    properties: {
      pageType: { type: "string", enum: ["profile", "landing_page", "seo", "chatbot", "lead_form"] },
      leadGoal: { type: "string", enum: ["buyer", "seller", "refinance", "all"] },
      marketCity: { type: "string" },
      marketState: { type: "string", description: "Two-letter state code." },
      currentCopy: { type: "string", description: "The officer's current headline/intro text, if they gave it." },
      currentChatbotIntro: { type: "string" },
      existingSeoTitle: { type: "string" },
      existingMetaDescription: { type: "string" },
    },
    additionalProperties: false,
  },
};

export const LIST_PENDING_WEBSITE_CHANGES_TOOL: AiToolDefinition = {
  name: "list_pending_website_changes",
  description:
    "List website/profile changes held for the officer's approval (id, title, before/after text, risk, reason). Call this when the officer asks what is waiting on them.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

export const DECIDE_WEBSITE_CHANGE_TOOL: AiToolDefinition = {
  name: "decide_website_change",
  description:
    "Approve or reject one held website/profile change by id. Only call this after the officer has explicitly said to approve or reject that specific change - never on your own initiative. Read the after-text back to them first if they have not seen it.",
  inputSchema: {
    type: "object",
    properties: {
      changeId: { type: "string" },
      decision: { type: "string", enum: ["approve", "reject"] },
    },
    required: ["changeId", "decision"],
    additionalProperties: false,
  },
};

export const DRAFT_MARKETING_CONTENT_TOOL: AiToolDefinition = {
  name: "draft_marketing_content",
  description:
    "Draft (never send) marketing copy for the officer to review: a social post, email, ad copy, a Google Business Profile post, or a Google Business Profile description. Returns text only.",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["social_post", "email", "ad_copy", "gmb_post", "gmb_description"] },
      goal: { type: "string", description: "What the content should accomplish, in the officer's words." },
      audience: { type: "string", description: "Who it is for, e.g. first-time buyers in Fresno." },
      channel: { type: "string", enum: ["facebook", "instagram", "linkedin", "email", "sms", "ad"], description: "For social_post/email/ad_copy." },
      topic: { type: "string" },
      brandVoice: { type: "string", description: "Tone, e.g. warm and plain-spoken." },
      businessName: { type: "string", description: "For gmb_post/gmb_description." },
      city: { type: "string", description: "For gmb_post/gmb_description." },
      services: { type: "array", items: { type: "string" }, description: "For gmb_post/gmb_description." },
      keywords: { type: "array", items: { type: "string" }, description: "For gmb_post/gmb_description." },
      gmbGoal: { type: "string", enum: ["update", "promotion", "announcement"] },
    },
    required: ["kind", "goal"],
    additionalProperties: false,
  },
};

export const DRAFT_LANDING_PAGE_TOOL: AiToolDefinition = {
  name: "draft_landing_page",
  description:
    "Draft the section-by-section copy of a landing page (hero, offer, proof, CTA) for a stated goal and offer. Returns a draft only - it does not publish anything.",
  inputSchema: {
    type: "object",
    properties: {
      goal: { type: "string", description: "e.g. get first-time buyers to book a consultation" },
      offer: { type: "string", description: "e.g. free home-buying game plan session" },
    },
    required: ["goal", "offer"],
    additionalProperties: false,
  },
};

export const MLO_TOOLS: AiToolDefinition[] = [
  GET_MY_PIPELINE_TOOL,
  RUN_WEBSITE_AUTOPILOT_TOOL,
  LIST_PENDING_WEBSITE_CHANGES_TOOL,
  DECIDE_WEBSITE_CHANGE_TOOL,
  DRAFT_MARKETING_CONTENT_TOOL,
  DRAFT_LANDING_PAGE_TOOL,
];

function str(value: unknown, max = 400): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function strList(value: unknown, maxItems = 10): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item, 80))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

/** Maps the signed-in officer (by session email) to their loan-officer record. */
function findOfficer(ctx: MloToolContext) {
  const email = ctx.userEmail?.trim().toLowerCase();
  if (!email) return undefined;
  return readDb().loanOfficers.find((officer) => officer.email.trim().toLowerCase() === email);
}

/** The officer's chosen autonomy, or undefined (historical safe default) if they have not set one. */
function autonomyFor(ctx: MloToolContext): AutopilotAutonomy | undefined {
  if (!ctx.userId) return undefined;
  return readAgentOnboarding(ctx.userId)?.autonomy;
}

function getMyPipeline(call: AiToolCall, ctx: MloToolContext): string {
  const officer = findOfficer(ctx);
  if (!officer) {
    return JSON.stringify({ error: "no_officer_profile", note: "No loan-officer profile is linked to this account yet." });
  }
  const requested = typeof call.input.limit === "number" ? Math.floor(call.input.limit) : 8;
  const limit = Math.max(1, Math.min(15, requested));
  const db = readDb();
  const crmById = new Map(db.crmLeads.map((lead) => [lead.borrowerLeadId, lead]));
  const leads = db.borrowerLeads
    .filter((lead) => lead.assignedLoId === officer.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((lead) => ({
      name: lead.answers.name ?? "Unnamed lead",
      createdAt: lead.createdAt,
      quality: lead.qualification.leadQuality,
      urgency: lead.qualification.urgency,
      program: lead.answers.loanProgram,
      consentToContact: lead.answers.contactConsent === true,
      status: crmById.get(lead.id)?.status ?? "new",
      nextStep: lead.qualification.recommendedNextStep,
    }));
  return JSON.stringify({ officer: officer.name, totalShown: leads.length, leads });
}

const PAGE_TYPES = new Set<AutopilotPageType>(["profile", "landing_page", "seo", "chatbot", "lead_form"]);
const LEAD_GOALS = new Set<LeadGoal>(["buyer", "seller", "refinance", "all"]);

function runAutopilot(call: AiToolCall, ctx: MloToolContext): string {
  const pageType = PAGE_TYPES.has(call.input.pageType as AutopilotPageType)
    ? (call.input.pageType as AutopilotPageType)
    : "profile";
  const leadGoal = LEAD_GOALS.has(call.input.leadGoal as LeadGoal) ? (call.input.leadGoal as LeadGoal) : "all";
  const officer = findOfficer(ctx);
  const plan = runWebsiteAutopilot({
    userId: ctx.userId,
    mloProfileId: officer?.id,
    mloProfile: officer ? { name: officer.name } : undefined,
    pageType,
    leadGoal,
    marketCity: str(call.input.marketCity, 80),
    marketState: str(call.input.marketState, 2)?.toUpperCase(),
    currentCopy: str(call.input.currentCopy, 1500),
    currentChatbotIntro: str(call.input.currentChatbotIntro, 600),
    existingSeoTitle: str(call.input.existingSeoTitle, 200),
    existingMetaDescription: str(call.input.existingMetaDescription, 400),
    autonomy: autonomyFor(ctx),
  });
  const wordpress = getWordPressAutopilotStatus();
  saveAutopilotRun(
    buildAutopilotRunRecord(plan, pageType, {
      userId: ctx.userId,
      mloProfileId: officer?.id,
      wordpressLive: wordpress.enabled,
    }),
  );
  return JSON.stringify({
    summary: plan.summaryForMlo,
    autoApplied: plan.autoAppliedCount,
    heldForApproval: plan.needsApprovalCount,
    autonomySetting: autonomyFor(ctx) ?? "default (safe edits only)",
    // Be honest with the officer: applied means recorded in their YPN USA profile; live WordPress publishing is a separate switch.
    livePublishing: wordpress.enabled ? "enabled" : "off - changes are saved in the YPN USA app and not yet pushed to a public web page",
    changes: plan.changes.slice(0, 10).map((change) => ({
      id: change.id,
      title: change.title,
      status: change.status,
      risk: change.riskLevel,
      afterText: change.afterText,
    })),
  });
}

function listPending(ctx: MloToolContext): string {
  if (!ctx.userId) return JSON.stringify({ error: "not_signed_in" });
  const pending = listWebsiteAutopilotChanges(ctx.userId)
    .filter((change) => change.status === "needs_approval" || change.status === "proposed")
    .slice(-15);
  return JSON.stringify({
    pending: pending.map((change) => ({
      id: change.id,
      title: change.title,
      risk: change.riskLevel,
      before: change.beforeText ?? null,
      after: change.afterText,
      reason: change.reason,
    })),
  });
}

function decideChange(call: AiToolCall, ctx: MloToolContext): string {
  if (!ctx.userId) return JSON.stringify({ error: "not_signed_in" });
  const changeId = str(call.input.changeId, 120);
  const decision = call.input.decision;
  if (!changeId || (decision !== "approve" && decision !== "reject")) {
    return JSON.stringify({ error: "changeId and decision (approve|reject) are required." });
  }
  // Ownership check: the change must belong to the signed-in officer.
  const change = listWebsiteAutopilotChanges(ctx.userId).find((item) => item.id === changeId);
  if (!change) return JSON.stringify({ error: "change_not_found" });
  if (change.status !== "needs_approval" && change.status !== "proposed") {
    return JSON.stringify({ error: "not_pending", currentStatus: change.status });
  }
  const now = new Date().toISOString();
  saveWebsiteAutopilotChange(
    decision === "approve"
      ? { ...change, status: "auto_applied", requiresApproval: false, autoApplied: false, updatedAt: now, rollbackNote: change.rollbackNote ?? "Approved by the officer in chat; restore beforeText to undo." }
      : { ...change, status: "rejected", requiresApproval: false, autoApplied: false, updatedAt: now },
  );
  return JSON.stringify({ ok: true, changeId, decision, title: change.title });
}

async function draftMarketing(call: AiToolCall): Promise<string> {
  const kind = call.input.kind;
  const goal = str(call.input.goal, 300);
  if (!goal) return JSON.stringify({ error: "goal is required." });
  const audience = str(call.input.audience, 200) ?? "local home buyers, sellers and homeowners";
  const brandVoice = str(call.input.brandVoice, 120) ?? "warm, plain-spoken, and factual";
  const channel = (str(call.input.channel, 20) ?? (kind === "email" ? "email" : kind === "ad_copy" ? "ad" : "facebook")) as PlatformChannel;
  const topic = str(call.input.topic, 200);

  const gmbProfile = {
    name: str(call.input.businessName, 120) ?? "Your mortgage practice",
    city: str(call.input.city, 80) ?? "your city",
    services: strList(call.input.services),
    keywords: strList(call.input.keywords),
  };
  const gmbGoalRaw = call.input.gmbGoal;
  const gmbGoal = gmbGoalRaw === "promotion" || gmbGoalRaw === "announcement" ? gmbGoalRaw : "update";

  let result;
  switch (kind) {
    case "social_post":
      result = await runAgent({ type: "marketing-social-post", request: { brandVoice, goal, audience, channel, topic } });
      break;
    case "email":
      result = await runAgent({ type: "marketing-email", request: { brandVoice, goal, audience, channel: "email", topic } });
      break;
    case "ad_copy":
      result = await runAgent({ type: "marketing-ad-copy", request: { brandVoice, goal, audience, channel: "ad", topic } });
      break;
    case "gmb_post":
      result = await runAgent({ type: "gmb-post", profile: gmbProfile, goal: gmbGoal });
      break;
    case "gmb_description":
      result = await runAgent({ type: "gmb-optimize-description", profile: gmbProfile });
      break;
    default:
      return JSON.stringify({ error: "Unknown kind." });
  }
  if (!result.ok) return JSON.stringify({ error: result.error ?? "Draft failed." });
  return JSON.stringify({
    draftOnly: true,
    note: "Draft for the officer to review. Not sent or published. Regulated language (rates, approvals, guarantees, NMLS) must be reviewed by the officer before use.",
    result: result.data,
  });
}

async function draftLandingPage(call: AiToolCall): Promise<string> {
  const goal = str(call.input.goal, 300);
  const offer = str(call.input.offer, 300);
  if (!goal || !offer) return JSON.stringify({ error: "goal and offer are required." });
  const result = await runAgent({ type: "website-landing-page", goal, offer });
  if (!result.ok) return JSON.stringify({ error: result.error ?? "Draft failed." });
  return JSON.stringify({ draftOnly: true, note: "Draft only - not published.", page: result.data });
}

/** Runs one MLO tool. Never throws; always returns a plain-text (JSON) result for the model. */
export async function executeMloTool(call: AiToolCall, ctx: MloToolContext): Promise<string> {
  try {
    switch (call.toolName) {
      case "get_my_pipeline":
        return getMyPipeline(call, ctx);
      case "run_website_autopilot":
        return runAutopilot(call, ctx);
      case "list_pending_website_changes":
        return listPending(ctx);
      case "decide_website_change":
        return decideChange(call, ctx);
      case "draft_marketing_content":
        return await draftMarketing(call);
      case "draft_landing_page":
        return await draftLandingPage(call);
      default:
        return JSON.stringify({ error: `Unknown tool: ${call.toolName}` });
    }
  } catch (error) {
    console.error(`[cerebro-tools] ${call.toolName} failed`, error);
    return JSON.stringify({ error: "That action failed. Tell the officer plainly and offer to try again." });
  }
}
