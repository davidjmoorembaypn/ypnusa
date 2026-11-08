import { NextResponse } from "next/server";
import { getEntitlement, getSession } from "@/lib/auth";
import { createSafeAgentTest, GOAL_COPY } from "@/lib/agent-onboarding";
import { syncOfficerProfile } from "@/lib/crm";
import { readAgentOnboarding, saveAgentOnboarding } from "@/lib/db";
import { automationDailyLimitFor } from "@/lib/entitlements";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import {
  officerPagePath,
  officerSlug,
  publicOfficerPageFor,
  validateOfficerProfileInput,
} from "@/lib/officer-profile";
import { rateLimit } from "@/lib/rate-limit";
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

  const limited = rateLimit(`onboarding:${session.sub}`, 30, 60_000);
  if (!limited.ok) {
    return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

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
    const requestedStep = Math.min(5, Math.max(1, Number(parsed.data.completedStep) || 1));
    // Saving the profile (step 1) never rolls back later progress or turns Cerebro off;
    // edits on steps 2-5 keep the existing rule (status follows the step, re-activation needed).
    const profileOnly = action === "profile";
    const completedStep = profileOnly ? Math.max(previous?.completedStep ?? 1, requestedStep) : requestedStep;
    const entitlement = await getEntitlement();
    const wantsActivation = action === "activate";
    if (wantsActivation && automationDailyLimitFor(entitlement) === 0) {
      return jsonError("A paid plan is required to activate live automations.", 402, "UPGRADE_REQUIRED");
    }
    // Loan officer profile. Step 1 sends action "profile" and must include a complete,
    // valid profile; later steps resend it and it is re-validated. When it is absent the
    // stored profile is kept. The headshot is never taken from this body: only the photo
    // upload route sets it.
    const rawProfile = isRecord(parsed.data.profile) ? parsed.data.profile : null;
    if (action === "profile" && !rawProfile) {
      return NextResponse.json(
        { ok: false, error: "Add your name, NMLS ID and phone to continue.", code: "INVALID_PROFILE", field: "fullName" },
        { status: 400 },
      );
    }
    let officerProfile = previous?.officerProfile;
    if (rawProfile) {
      const checked = validateOfficerProfileInput(rawProfile);
      if (!checked.ok) {
        return NextResponse.json(
          { ok: false, error: checked.error, code: "INVALID_PROFILE", field: checked.field },
          { status: 400 },
        );
      }
      officerProfile = {
        ...checked.value,
        slug: officerSlug(checked.value.fullName, session.sub),
        updatedAt: now,
      };
    }

    const rawConnections = isRecord(parsed.data.connections) ? parsed.data.connections : {};
    const territoryZip = typeof parsed.data.territoryZip === "string" && /^\d{5}$/.test(parsed.data.territoryZip)
      ? parsed.data.territoryZip
      : undefined;
    // A profile save on an existing record changes only step 1 (profile + working ZIP code):
    // goal, permissions, test and activation state stay exactly as they were.
    const record: AgentOnboardingRecord = profileOnly && previous ? {
      ...previous,
      email: session.email,
      completedStep,
      territoryZip: territoryZip ?? previous.territoryZip,
      ...(officerProfile ? { officerProfile } : {}),
      updatedAt: now,
    } : {
      userId: session.sub,
      email: session.email,
      status: wantsActivation ? "active" : completedStep >= 4 ? "ready" : "draft",
      completedStep,
      goal,
      goalDescription: typeof parsed.data.goalDescription === "string" && parsed.data.goalDescription.trim()
        ? parsed.data.goalDescription.trim().slice(0, 500)
        : GOAL_COPY[goal].description,
      territoryZip,
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
      ...(officerProfile ? { officerProfile } : {}),
      ...(previous?.officerPhoto ? { officerPhoto: previous.officerPhoto } : {}),
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    saveAgentOnboarding(record);
    if (rawProfile) {
      // Best effort: the CRM mirror must never fail the save the officer just made.
      try {
        syncOfficerProfile(session.sub);
      } catch (error) {
        logApiError("/api/onboarding (officer profile sync)", error);
      }
    }
    const page = publicOfficerPageFor(record);
    return jsonOk({ profile: record, borrowerPagePath: page ? officerPagePath(page.slug) : null });
  } catch (error) {
    logApiError("/api/onboarding", error);
    return jsonError("Unable to save onboarding.", 500, "SAVE_FAILED");
  }
}
