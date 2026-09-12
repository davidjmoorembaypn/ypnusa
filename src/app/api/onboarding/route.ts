import { getEntitlement, getSession } from "@/lib/auth";
import { createSafeAgentTest, GOAL_COPY } from "@/lib/agent-onboarding";
import { readAgentOnboarding, saveAgentOnboarding } from "@/lib/db";
import { automationDailyLimitFor } from "@/lib/entitlements";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import type { AgentOnboardingGoal, AgentOnboardingRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOALS = new Set<AgentOnboardingGoal>(["speed_to_lead", "nurture_to_booking", "partner_growth"]);

export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Authentication required.", 401, "UNAUTHORIZED");
  const entitlement = await getEntitlement();
  return jsonOk({
    profile: readAgentOnboarding(session.sub),
    entitlement: { tier: entitlement.tier, dailyLimit: automationDailyLimitFor(entitlement) },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Authentication required.", 401, "UNAUTHORIZED");
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok || !isRecord(parsed.data)) return jsonError("Invalid onboarding data.", 400, "INVALID_BODY");
    const action = parsed.data.action;
    if (action === "test") return jsonOk({ test: createSafeAgentTest() });

    const goal = GOALS.has(parsed.data.goal as AgentOnboardingGoal)
      ? (parsed.data.goal as AgentOnboardingGoal)
      : "speed_to_lead";
    const previous = readAgentOnboarding(session.sub);
    const now = new Date().toISOString();
    const completedStep = Math.min(5, Math.max(1, Number(parsed.data.completedStep) || 1));
    const entitlement = await getEntitlement();
    const wantsActivation = action === "activate";
    if (wantsActivation && automationDailyLimitFor(entitlement) === 0) {
      return jsonError("A paid plan is required to activate live automations.", 402, "UPGRADE_REQUIRED");
    }
    const rawConnections = isRecord(parsed.data.connections) ? parsed.data.connections : {};
    const record: AgentOnboardingRecord = {
      userId: session.sub,
      email: session.email,
      status: wantsActivation ? "active" : completedStep >= 4 ? "ready" : "draft",
      completedStep,
      goal,
      goalDescription: typeof parsed.data.goalDescription === "string" && parsed.data.goalDescription.trim()
        ? parsed.data.goalDescription.trim().slice(0, 500)
        : GOAL_COPY[goal].description,
      territoryZip: typeof parsed.data.territoryZip === "string" && /^\d{5}$/.test(parsed.data.territoryZip)
        ? parsed.data.territoryZip
        : undefined,
      connections: {
        email: rawConnections.email === true,
        sms: rawConnections.sms === true,
        calendar: rawConnections.calendar === true,
        crm: rawConnections.crm === true,
      },
      autonomy: parsed.data.autonomy === "autonomous_with_guardrails"
        ? "autonomous_with_guardrails"
        : "approval_first",
      confidenceThreshold: Math.min(95, Math.max(60, Number(parsed.data.confidenceThreshold) || 80)),
      testPassedAt: typeof parsed.data.testPassedAt === "string" ? parsed.data.testPassedAt : previous?.testPassedAt,
      activatedAt: wantsActivation ? now : previous?.activatedAt,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    saveAgentOnboarding(record);
    return jsonOk({ profile: record });
  } catch (error) {
    logApiError("/api/onboarding", error);
    return jsonError("Unable to save onboarding.", 500, "SAVE_FAILED");
  }
}
