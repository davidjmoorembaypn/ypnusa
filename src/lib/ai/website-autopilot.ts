import { generateId } from "@/lib/id";
import { saveWebsiteAutopilotChange } from "@/lib/db";
import type {
  AutopilotChangeStatus,
  AutopilotChangeType,
  AutopilotPageType,
  AutopilotRiskLevel,
  WebsiteAutopilotChange,
} from "@/lib/types";

/**
 * Website/Profile Autopilot: a deterministic (non-LLM) planner that turns an
 * MLO's current profile/landing-page copy into a set of classified changes —
 * some safe enough to apply automatically, some held for human review. This
 * is the "operator, not advisor" foundation: YPNUS does the editing work
 * itself instead of handing the MLO a list of suggestions to implement.
 *
 * Deliberately deterministic and side-effect-free in generateWebsiteAutopilotPlan
 * (no AI provider call, no DB write) so it's fully unit-testable and safe to
 * run without ANTHROPIC_API_KEY configured. runWebsiteAutopilot wraps it to
 * persist the resulting changes via db.ts's existing storage pattern.
 */

export type LeadGoal = "buyer" | "seller" | "refinance" | "all";

export interface WebsiteAutopilotPlanInput {
  userId?: string;
  mloProfileId?: string;
  mloProfile?: { name?: string };
  pageType: AutopilotPageType;
  currentCopy?: string;
  targetAudience?: string;
  marketCity?: string;
  marketState?: string;
  leadGoal?: LeadGoal;
  existingSeoTitle?: string;
  existingMetaDescription?: string;
  currentChatbotIntro?: string;
}

export interface WebsiteAutopilotPlan {
  score: number;
  changes: WebsiteAutopilotChange[];
  summaryForMlo: string;
  autoAppliedCount: number;
  needsApprovalCount: number;
  safeToShowMloSummary: boolean;
}

/** Never let generated or existing copy containing these terms auto-apply — always route to a human, regardless of changeType. */
const COMPLIANCE_KEYWORDS: RegExp[] = [
  /\brates?\b/i,
  /\bapr\b/i,
  /guarantee/i,
  /guaranteed/i,
  /pre-?approv/i,
  /\bapprov(ed|al)\b/i,
  /\bnmls\b/i,
  /\blicens/i,
];

function containsComplianceLanguage(text: string | undefined): boolean {
  if (!text) return false;
  return COMPLIANCE_KEYWORDS.some((re) => re.test(text));
}

/** Baseline risk per change type — see docs/ai-assistant.md for the low-risk / needs-approval catalogue. */
const BASE_RISK: Record<AutopilotChangeType, AutopilotRiskLevel> = {
  headline: "low",
  cta: "low",
  chatbot_greeting: "low",
  lead_form_helper_text: "low",
  audience_positioning: "low",
  local_market_wording: "low",
  seo_title: "low",
  seo_meta_description: "low",
  profile_completeness: "low",
  trust_copy: "low",
  rate_apr_language: "high",
  guaranteed_savings_language: "high",
  loan_approval_language: "high",
  compliance_disclosure: "high",
  license_nmls_change: "high",
  brand_claim_change: "medium",
  live_publish: "high",
  paid_ad_copy: "medium",
  sms_email_send: "high",
};

function classifyRisk(changeType: AutopilotChangeType, afterText: string): AutopilotRiskLevel {
  const base = BASE_RISK[changeType];
  // Defensive: even a nominally low-risk change type never auto-applies if the
  // generated text itself touches compliance-sensitive language.
  if (base !== "high" && containsComplianceLanguage(afterText)) return "medium";
  return base;
}

function statusFor(risk: AutopilotRiskLevel, hasGroundingText: boolean): AutopilotChangeStatus {
  if (risk !== "low") return "needs_approval";
  // Low risk but nothing concrete to diff against yet — hold for a glance
  // rather than blind-apply text with no grounding in the MLO's real copy.
  return hasGroundingText ? "auto_applied" : "proposed";
}

interface DraftChange {
  changeType: AutopilotChangeType;
  title: string;
  beforeText?: string;
  afterText: string;
  reason: string;
  expectedBenefit: string;
}

function buildChange(pageType: AutopilotPageType, draft: DraftChange): WebsiteAutopilotChange {
  const risk = classifyRisk(draft.changeType, draft.afterText);
  const hasGrounding = Boolean(draft.beforeText && draft.beforeText.trim());
  const status = statusFor(risk, hasGrounding);
  const now = new Date().toISOString();
  return {
    id: generateId("autopilot"),
    pageType,
    changeType: draft.changeType,
    title: draft.title,
    beforeText: draft.beforeText,
    afterText: draft.afterText,
    reason: draft.reason,
    expectedBenefit: draft.expectedBenefit,
    riskLevel: risk,
    status,
    autoApplied: status === "auto_applied",
    requiresApproval: status === "needs_approval",
    createdAt: now,
    updatedAt: now,
  };
}

function leadGoalLabel(goal: LeadGoal | undefined): string {
  switch (goal) {
    case "buyer":
      return "buyer";
    case "seller":
      return "seller";
    case "refinance":
      return "refinance";
    default:
      return "buyer, seller, and refinance";
  }
}

function joinNaturally(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function generateWebsiteAutopilotPlan(input: WebsiteAutopilotPlanInput): WebsiteAutopilotPlan {
  const city = input.marketCity?.trim();
  const state = input.marketState?.trim();
  const location = city ? (state ? `${city}, ${state}` : city) : "your service area";
  const goalLabel = leadGoalLabel(input.leadGoal);
  const mloName = input.mloProfile?.name?.trim();

  const changes: WebsiteAutopilotChange[] = [];

  changes.push(
    buildChange(input.pageType, {
      changeType: "headline",
      title: "Strengthen headline",
      beforeText: input.currentCopy,
      afterText: `Local mortgage guidance for ${goalLabel} leads in ${location}${mloName ? ` — with ${mloName}` : ""}.`,
      reason: "A benefit- and location-led headline converts better than a generic welcome message.",
      expectedBenefit: "Higher click-through and time-on-page from local visitors.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "cta",
      title: "Strengthen call-to-action wording",
      beforeText: input.currentCopy,
      afterText: `Start My Free ${goalLabel === "buyer" ? "Buyer" : goalLabel === "seller" ? "Seller" : goalLabel === "refinance" ? "Refinance" : "Homeownership"} Consultation`,
      reason: "A specific, benefit-oriented CTA outperforms generic \"Contact us\" wording.",
      expectedBenefit: "More form starts from visitors who are ready to act.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "chatbot_greeting",
      title: "Improve chatbot greeting",
      beforeText: input.currentChatbotIntro,
      afterText: `Hi! I'm here to help with buying, selling, or refinancing in ${location}. What are you looking to do?`,
      reason: "A short, local, question-first greeting gets more visitors to respond.",
      expectedBenefit: "Higher chatbot engagement and lead capture rate.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "lead_form_helper_text",
      title: "Improve lead form helper text",
      beforeText: input.currentCopy,
      afterText: "Share a few details and a local loan officer will follow up personally — no obligation, no spam.",
      reason: "Reassuring, low-pressure helper text reduces form abandonment.",
      expectedBenefit: "More completed lead forms.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "audience_positioning",
      title: "Clarify buyer/seller/refinance positioning",
      beforeText: input.currentCopy,
      afterText: `Helping ${goalLabel} clients in ${location} navigate their next move with a dedicated local loan officer.`,
      reason: "Visitors convert better when the page speaks directly to their situation.",
      expectedBenefit: "Better-qualified leads matched to the right intake flow.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "local_market_wording",
      title: "Improve local market wording",
      beforeText: input.currentCopy,
      afterText: `Proudly serving homebuyers and homeowners in ${location}.`,
      reason: "Explicit local-market language builds trust and improves local search relevance.",
      expectedBenefit: "Stronger local relevance and trust signal.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "seo_title",
      title: "Prepare SEO title improvement",
      beforeText: input.existingSeoTitle,
      afterText: `${location} Mortgage Loan Officer | YPN USA`,
      reason: "A location + role SEO title improves search relevance for local queries.",
      expectedBenefit: "Improved organic search visibility for local searches.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "seo_meta_description",
      title: "Prepare SEO meta description improvement",
      beforeText: input.existingMetaDescription,
      afterText: `Local mortgage guidance for ${goalLabel} clients in ${location}. Get started today.`,
      reason: "A clear, local meta description improves click-through from search results.",
      expectedBenefit: "Improved search click-through rate.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "profile_completeness",
      title: "Improve profile completeness copy",
      beforeText: input.currentCopy,
      afterText: "Add your service area, specialties, and a short personal introduction so borrowers can connect with you faster.",
      reason: "Complete profiles build more trust with visiting borrowers.",
      expectedBenefit: "Higher visitor-to-lead conversion.",
    }),
  );

  changes.push(
    buildChange(input.pageType, {
      changeType: "trust_copy",
      title: "Strengthen trust-building copy",
      beforeText: input.currentCopy,
      afterText: "Backed by YPN USA's dedicated local team — here to guide you every step of the way.",
      reason: "Trust-building copy that avoids specific legal/license claims is safe to strengthen automatically.",
      expectedBenefit: "Improved visitor confidence without any compliance risk.",
    }),
  );

  // Hold compliance-sensitive existing copy for review instead of rewriting it automatically.
  if (containsComplianceLanguage(input.currentCopy)) {
    changes.push(
      buildChange(input.pageType, {
        changeType: "compliance_disclosure",
        title: "Review rate/guarantee/approval language",
        beforeText: input.currentCopy,
        afterText: input.currentCopy ?? "",
        reason:
          "Current copy contains rate/APR, guarantee, or approval-style language, which requires compliance review before any change is made.",
        expectedBenefit: "Avoids regulatory risk while preserving accurate, compliant claims.",
      }),
    );
  }

  const autoApplied = changes.filter((c) => c.status === "auto_applied");
  const needsApproval = changes.filter((c) => c.status === "needs_approval");

  const score = Math.max(
    0,
    Math.min(100, 55 + autoApplied.length * 4 - needsApproval.length * 5),
  );

  const appliedTitles = autoApplied.map((c) => c.title.replace(/^(Strengthen|Improve|Prepare|Clarify)\s/, "").toLowerCase());
  const summaryForMlo =
    changes.length === 0
      ? `No safe YPNUS-controlled improvements were found for ${location} right now.`
      : `YPNUS improved your ${input.pageType.replace("_", " ")} to help capture more ${location} ${goalLabel} leads.` +
        (appliedTitles.length > 0 ? ` We ${joinNaturally(appliedTitles)}.` : "") +
        (needsApproval.length > 0
          ? ` ${needsApproval.length} item${needsApproval.length === 1 ? "" : "s"} ${needsApproval.length === 1 ? "was" : "were"} held for your quick review.`
          : " No manual work is required.");

  return {
    score,
    changes,
    summaryForMlo,
    autoAppliedCount: autoApplied.length,
    needsApprovalCount: needsApproval.length,
    safeToShowMloSummary: changes.length > 0,
  };
}

/** Generates a plan and persists every change via db.ts, stamping userId/mloProfileId onto each. */
export function runWebsiteAutopilot(input: WebsiteAutopilotPlanInput): WebsiteAutopilotPlan {
  const plan = generateWebsiteAutopilotPlan(input);
  for (const change of plan.changes) {
    change.userId = input.userId;
    change.mloProfileId = input.mloProfileId;
    saveWebsiteAutopilotChange(change);
  }
  return plan;
}
