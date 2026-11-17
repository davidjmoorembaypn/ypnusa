import {
  consumeFreeAction,
  listCerebroActions,
  listWebsiteAutopilotChanges,
  readAgentOnboarding,
  readDb,
  saveAutopilotRun,
  saveCerebroAction,
  writeDb,
  saveWebsiteAutopilotChange,
} from "@/lib/db";
import { runAgent } from "@/lib/agents/coreAgent";
import { GENERIC_MARKETING_DISCLOSURES, withMarketingDisclosures } from "@/lib/compliance/guardrails";
import type { PlatformChannel } from "@/lib/agents/marketingAgent";
import type { AutopilotPageType } from "@/lib/types";
import { CUSTOMER_PORTAL_URL, marketingUrl } from "@/lib/site";
import { isLiveSubscription } from "@/lib/subscription-live";
import { getWordPressAutopilotStatus } from "@/lib/wordpress";
import { FREE_DAILY_ACTIONS, FREE_METERED_TOOLS, PAID_ONLY_TOOLS, upgradeRequiredResult, utcDay } from "@/lib/free-tier";
import {
  complianceOfficerOf,
  executeDraftPrequalLetter,
  executeDraftRateAlerts,
  executeRunFollowUps,
  OFFICER_FOLLOW_UP_TOOL_NAMES,
  OFFICER_FOLLOW_UP_TOOLS,
} from "./follow-up-tools";
import type { AiToolCall, AiToolDefinition } from "./provider";
import {
  buildAutopilotRunRecord,
  generateWebsiteAutopilotPlan,
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
  /** True for an active paid plan or an admin. Free accounts get previews and FREE_DAILY_ACTIONS a day (src/lib/free-tier.ts). */
  paidPlan?: boolean;
}

export const MLO_TOOL_NAMES = new Set([
  "get_my_pipeline",
  "run_website_autopilot",
  "list_pending_website_changes",
  "decide_website_change",
  "draft_marketing_content",
  "draft_landing_page",
  "list_queued_actions",
  "decide_queued_action",
  "set_reply_mode",
  "get_my_account",
  ...OFFICER_FOLLOW_UP_TOOL_NAMES,
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

export const LIST_QUEUED_ACTIONS_TOOL: AiToolDefinition = {
  name: "list_queued_actions",
  description:
    "List what Cerebro queued for this loan officer: items waiting for them (callback requests, prequal requests and letters, and any email Cerebro couldn't send on its own, with needsYou saying why) plus the emails Cerebro already sent to borrowers for them. Also returns their reply mode. Call when they ask what needs them, who wants a call, or what Cerebro did.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

export const DECIDE_QUEUED_ACTION_TOOL: AiToolDefinition = {
  name: "decide_queued_action",
  description:
    "Mark one queued item approved or dismissed by id, optionally with the officer's edited text. Approving an email check-in, first reply or rate alert lets Cerebro email it to the borrower within 5 minutes, once the borrower's consent and the compliance checks allow; texts, calls, callbacks and prequal letters are never sent by Cerebro, so give the officer the final text. Only call after the officer explicitly says to approve or dismiss that specific item.",
  inputSchema: {
    type: "object",
    properties: {
      actionId: { type: "string" },
      decision: { type: "string", enum: ["approve", "dismiss"] },
      editedBody: { type: "string", description: "The officer's own edited wording, if they changed it." },
    },
    required: ["actionId", "decision"],
    additionalProperties: false,
  },
};

export const SET_REPLY_MODE_TOOL: AiToolDefinition = {
  name: "set_reply_mode",
  description:
    "Set how Cerebro follows up with this officer's borrowers by email. live (the default): Cerebro emails check-ins, first replies and rate alerts on its own when the borrower agreed to be contacted and every compliance check passes. approve: every one waits for the officer's OK. Only call when the officer asks to change it.",
  inputSchema: {
    type: "object",
    properties: { mode: { type: "string", enum: ["live", "approve"] } },
    required: ["mode"],
    additionalProperties: false,
  },
};

export const GET_MY_ACCOUNT_TOOL: AiToolDefinition = {
  name: "get_my_account",
  description:
    "The signed-in loan officer's own account, live: plan and status, the ZIP codes they hold, profile and setup gaps (NMLS ID, licensed states, public page), lead counts, what waits for them and what Cerebro sent, reply mode, and the billing portal. Call for any question about their account, plan, ZIP codes, setup, billing or how they're doing.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

export const MLO_TOOLS: AiToolDefinition[] = [
  GET_MY_PIPELINE_TOOL,
  RUN_WEBSITE_AUTOPILOT_TOOL,
  LIST_PENDING_WEBSITE_CHANGES_TOOL,
  DECIDE_WEBSITE_CHANGE_TOOL,
  DRAFT_MARKETING_CONTENT_TOOL,
  DRAFT_LANDING_PAGE_TOOL,
  LIST_QUEUED_ACTIONS_TOOL,
  DECIDE_QUEUED_ACTION_TOOL,
  SET_REPLY_MODE_TOOL,
  GET_MY_ACCOUNT_TOOL,
  ...OFFICER_FOLLOW_UP_TOOLS,
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

/**
 * Free plan: the same website check, saved nowhere and applied to nothing. Cerebro shows what
 * it would change; a paid plan applies and keeps the changes.
 */
function previewAutopilot(call: AiToolCall, ctx: MloToolContext): string {
  const pageType = PAGE_TYPES.has(call.input.pageType as AutopilotPageType)
    ? (call.input.pageType as AutopilotPageType)
    : "profile";
  const leadGoal = LEAD_GOALS.has(call.input.leadGoal as LeadGoal) ? (call.input.leadGoal as LeadGoal) : "all";
  const officer = findOfficer(ctx);
  const plan = generateWebsiteAutopilotPlan({
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
  });
  return JSON.stringify({
    preview: true,
    applied: 0,
    wouldChange: plan.changes.slice(0, 10).map((change) => ({
      title: change.title,
      risk: change.riskLevel,
      afterText: change.afterText,
      expectedBenefit: change.expectedBenefit,
    })),
    pricingUrl: marketingUrl("/pricing"),
    howToReply:
      "Show the changes Cerebro would make, one short line each. Say plainly this is a preview on the Free plan: nothing was changed, and a paid plan has Cerebro apply these and keep the page improving on autopilot. Give the pricing link once.",
  });
}

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

async function draftMarketing(call: AiToolCall, ctx: MloToolContext): Promise<string> {
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
  const disclosed = addMarketingDisclosures(kind, channel, result.data, findOfficer(ctx));
  return JSON.stringify({
    draftOnly: true,
    note: "Draft for the officer to review. Not sent or published. Regulated language (rates, approvals, guarantees, NMLS) must be reviewed by the officer before use.",
    result: disclosed.data,
    ...disclosed.meta,
  });
}

/** The text field of each draft kind that gets the officer's disclosures. A GBP description gets none (it describes the business, it isn't an ad). */
const DISCLOSURE_FIELD: Partial<Record<string, string>> = {
  social_post: "body",
  email: "body",
  ad_copy: "primaryText",
  gmb_post: "postText",
};

/**
 * Upgrade 6.6: marketing drafts carry the officer's license disclosures, like Cerebro's other
 * messages. Without a linked officer profile, the draft is returned as is with the list of
 * what to add, so nothing goes out looking complete when it isn't.
 */
function addMarketingDisclosures(
  kind: unknown,
  channel: PlatformChannel,
  data: unknown,
  officer: ReturnType<typeof findOfficer>,
): { data: unknown; meta: Record<string, unknown> } {
  const field = typeof kind === "string" ? DISCLOSURE_FIELD[kind] : undefined;
  if (!field || !data || typeof data !== "object") return { data, meta: {} };
  const record = data as Record<string, unknown>;
  const text = record[field];
  if (typeof text !== "string") return { data, meta: {} };
  if (!officer) {
    return { data, meta: { disclosuresNeeded: [...GENERIC_MARKETING_DISCLOSURES], disclosureNote: "No loan officer profile is linked, so add these before posting." } };
  }
  const complianceChannel = channel === "sms" ? "sms" : kind === "email" ? "email" : "social_caption";
  const added = withMarketingDisclosures(text, complianceOfficerOf(officer), complianceChannel);
  const meta: Record<string, unknown> = { disclosuresAdded: added.appended };
  if (!officer.nmlsId) meta.disclosureNote = "Fill in your NMLS ID where the draft shows the placeholder, and add it to your profile.";
  return { data: { ...record, [field]: added.text }, meta };
}

async function draftLandingPage(call: AiToolCall): Promise<string> {
  const goal = str(call.input.goal, 300);
  const offer = str(call.input.offer, 300);
  if (!goal || !offer) return JSON.stringify({ error: "goal and offer are required." });
  const result = await runAgent({ type: "website-landing-page", goal, offer });
  if (!result.ok) return JSON.stringify({ error: result.error ?? "Draft failed." });
  return JSON.stringify({ draftOnly: true, note: "Draft only - not published.", page: result.data });
}

function listQueued(ctx: MloToolContext): string {
  const officer = findOfficer(ctx);
  if (!officer) return JSON.stringify({ error: "no_officer_profile", note: "No loan-officer profile is linked to this account yet." });
  const leads = new Map(readDb().borrowerLeads.map((lead) => [lead.id, lead]));
  const mine = listCerebroActions(officer.id);
  const borrower = (id: string) => leads.get(id)?.answers.name ?? "Unnamed lead";
  const open = mine
    .filter((action) => action.status === "awaiting_approval")
    .slice(-20)
    .map((action) => ({
      id: action.id,
      kind: action.kind,
      borrower: borrower(action.borrowerLeadId),
      channel: action.channel,
      preferredWindow: action.preferredWindow ?? null,
      needsYou: action.holdReason ?? null,
      subject: action.subject ?? null,
      text: action.body,
      createdAt: action.createdAt,
    }));
  const sent = mine
    .filter((action) => action.status === "sent")
    .slice(-10)
    .map((action) => ({ borrower: borrower(action.borrowerLeadId), kind: action.kind, subject: action.subject ?? null, sentAt: action.sentAt }));
  const waiting = mine.filter((action) => action.status === "held").length;
  return JSON.stringify({
    replyMode: officer.cerebroReplyMode === "approve" ? "approve" : "live",
    waitingForYou: open.length,
    items: open,
    recentlySentByCerebro: sent,
    waitingToSend: waiting,
  });
}

function getMyAccount(ctx: MloToolContext): string {
  const email = ctx.userEmail?.trim().toLowerCase();
  if (!email) return JSON.stringify({ error: "not_signed_in" });
  const db = readDb();
  const officer = findOfficer(ctx);
  const plans = db.revenueSubscriptions
    .filter(
      (sub) =>
        (sub.ownerEmail?.trim().toLowerCase() === email || (officer && sub.ownerLoId === officer.id)) &&
        sub.status !== "cancelled" &&
        isLiveSubscription(sub),
    )
    .map((sub) => ({ plan: sub.tier, status: sub.status, zipCodes: sub.claimedZips, since: sub.startedAt }));
  const since30 = Date.now() - 30 * 86400000;
  const leads = officer ? db.borrowerLeads.filter((lead) => lead.assignedLoId === officer.id) : [];
  const actions = officer ? db.cerebroActions.filter((action) => action.loId === officer.id) : [];
  const setupGaps = [
    !officer ? "No loan-officer profile yet: finish the steps at /onboarding." : null,
    officer && !officer.nmlsId ? "Add your NMLS ID (needed on every message)." : null,
    officer && !(officer.licenses ?? []).length ? "List the states you're licensed in (Cerebro won't email borrowers on its own without them)." : null,
    officer && !officer.publicSlug ? "Save your profile to publish your page at ypnus.com/lo/your-name." : null,
    plans.length === 0 ? "No paid plan, so no ZIP code is locked to you yet." : null,
  ].filter(Boolean);
  return JSON.stringify({
    name: officer?.name ?? null,
    plans,
    zipCodes: [...new Set(plans.flatMap((plan) => plan.zipCodes))],
    profile: officer
      ? {
          nmlsOnFile: Boolean(officer.nmlsId),
          licensedStates: [...new Set((officer.licenses ?? []).map((license) => license.state))],
          company: officer.company ?? null,
          publicPage: officer.publicSlug ? marketingUrl(`/lo/${officer.publicSlug}`) : null,
        }
      : null,
    setupGaps,
    leads: { total: leads.length, last30Days: leads.filter((lead) => Date.parse(lead.createdAt) >= since30).length },
    waitingForYou: actions.filter((action) => action.status === "awaiting_approval").length,
    emailsCerebroSentLast30Days: actions.filter((action) => action.status === "sent" && Date.parse(action.sentAt ?? "") >= since30).length,
    replyMode: officer?.cerebroReplyMode === "approve" ? "approve" : "live",
    billingPortal: CUSTOMER_PORTAL_URL,
  });
}

function setReplyMode(call: AiToolCall, ctx: MloToolContext): string {
  const officer = findOfficer(ctx);
  if (!officer) return JSON.stringify({ error: "no_officer_profile" });
  const mode = call.input.mode;
  if (mode !== "live" && mode !== "approve") return JSON.stringify({ error: "mode must be live or approve." });
  writeDb((db) => {
    const record = db.loanOfficers.find((item) => item.id === officer.id);
    if (record) record.cerebroReplyMode = mode;
  });
  return JSON.stringify({
    ok: true,
    mode,
    note:
      mode === "live"
        ? "Cerebro now emails check-ins, first replies and rate alerts on its own when the borrower agreed and every compliance check passes. Prequal letters and anything risky still wait for them."
        : "Every borrower email now waits for their OK in list_queued_actions.",
  });
}

function decideQueued(call: AiToolCall, ctx: MloToolContext): string {
  const officer = findOfficer(ctx);
  if (!officer) return JSON.stringify({ error: "no_officer_profile" });
  const actionId = str(call.input.actionId, 120);
  const decision = call.input.decision;
  if (!actionId || (decision !== "approve" && decision !== "dismiss")) {
    return JSON.stringify({ error: "actionId and decision (approve|dismiss) are required." });
  }
  // Ownership check: only this officer's own queue.
  const action = listCerebroActions(officer.id).find((item) => item.id === actionId);
  if (!action) return JSON.stringify({ error: "not_found" });
  if (action.status !== "awaiting_approval") return JSON.stringify({ error: "already_decided", status: action.status });
  const editedBody = str(call.input.editedBody, 2000);
  const now = new Date().toISOString();
  saveCerebroAction({
    ...action,
    status: decision === "approve" ? "approved" : "dismissed",
    body: editedBody ?? action.body,
    ...(decision === "approve" ? { approvedAt: now } : {}),
    holdReason: undefined,
    updatedAt: now,
  });
  const cerebroSends = decision === "approve" && action.channel === "email" && ["follow_up_draft", "nudge_draft", "rate_alert_draft"].includes(action.kind);
  return JSON.stringify({
    ok: true,
    actionId,
    decision,
    note:
      decision === "dismiss"
        ? "Dismissed."
        : cerebroSends
          ? "Approved. Cerebro emails it within 5 minutes if the borrower's consent and the compliance checks allow; if something still blocks it, it comes back here with the reason."
          : "Approved. Cerebro doesn't send this kind itself: give the officer the final text to send from their own phone or email.",
    finalText: decision === "approve" && !cerebroSends ? (editedBody ?? action.body) : undefined,
  });
}

/** Runs one MLO tool. Never throws; always returns a plain-text (JSON) result for the model. */
export async function executeMloTool(call: AiToolCall, ctx: MloToolContext): Promise<string> {
  try {
    if (ctx.paidPlan !== true) {
      if (PAID_ONLY_TOOLS.has(call.toolName)) return upgradeRequiredResult("paid_only");
      if (call.toolName === "run_website_autopilot") return previewAutopilot(call, ctx);
      if (FREE_METERED_TOOLS.has(call.toolName)) {
        if (!ctx.userId || !consumeFreeAction(ctx.userId, utcDay(), FREE_DAILY_ACTIONS)) {
          return upgradeRequiredResult("daily_action_used");
        }
      }
    }
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
        return await draftMarketing(call, ctx);
      case "draft_landing_page":
        return await draftLandingPage(call);
      case "list_queued_actions":
        return listQueued(ctx);
      case "decide_queued_action":
        return decideQueued(call, ctx);
      case "set_reply_mode":
        return setReplyMode(call, ctx);
      case "get_my_account":
        return getMyAccount(ctx);
      case "run_follow_ups":
      case "draft_rate_alerts":
      case "draft_prequal_letter": {
        const officer = findOfficer(ctx);
        if (!officer) return JSON.stringify({ error: "no_officer_profile", note: "No loan-officer profile is linked to this account yet." });
        if (call.toolName === "run_follow_ups") return executeRunFollowUps(call, officer);
        if (call.toolName === "draft_rate_alerts") return executeDraftRateAlerts(call, officer);
        return executeDraftPrequalLetter(call, officer);
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${call.toolName}` });
    }
  } catch (error) {
    console.error(`[cerebro-tools] ${call.toolName} failed`, error);
    return JSON.stringify({ error: "That action failed. Tell the officer plainly and offer to try again." });
  }
}
