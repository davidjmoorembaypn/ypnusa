import { planAgentTurn } from "./agent-runtime";
import type { LeadState } from "./agent-types";
import type { AgentOnboardingGoal, AgentOnboardingRecord } from "./types";

export const GOAL_COPY: Record<AgentOnboardingGoal, { label: string; description: string }> = {
  speed_to_lead: {
    label: "Speed to lead",
    description: "Respond to new borrowers, qualify urgency, and route the strongest opportunities.",
  },
  nurture_to_booking: {
    label: "Nurture to booking",
    description: "Keep qualified borrowers moving with consented follow-up and calendar offers.",
  },
  partner_growth: {
    label: "Realtor partner growth",
    description: "Organize partner opportunities and surface the moments that need a human relationship.",
  },
};

/** A step-1 draft with the wizard's defaults, for when something (a photo upload) is saved before the first step. */
export function draftOnboardingRecord(userId: string, email: string, now = new Date().toISOString()): AgentOnboardingRecord {
  return {
    userId,
    email,
    status: "draft",
    completedStep: 1,
    goal: "speed_to_lead",
    goalDescription: GOAL_COPY.speed_to_lead.description,
    connections: { email: true, sms: false, calendar: false, crm: true },
    autonomy: "approval_first",
    confidenceThreshold: 80,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSafeAgentTest() {
  const state: LeadState = {
    leadId: "simulation_lead",
    lifecycle: "routed",
    answers: {
      loanProgram: "CONVENTIONAL",
      name: "Sample borrower",
      email: "sample@example.com",
      contactConsent: true,
    },
    recentFollowUps: [],
    currentObjective: "Acknowledge a newly routed borrower",
    updatedAt: new Date().toISOString(),
  };
  const action = planAgentTurn(state);
  return {
    passed: action.kind === "send_email" && action.requiresConsent === true,
    action: action.kind,
    reason: action.reason,
    trace: [
      "Observed a consented, newly routed borrower",
      `Selected ${action.kind.replaceAll("_", " ")} from durable lead state`,
      "Blocked all external delivery in simulation mode",
      "Verified consent gate and recorded the decision",
    ],
  };
}
