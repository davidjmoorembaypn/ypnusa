import { getSession } from "@/lib/auth";
import { buildAutopilotRunRecord, generateWebsiteAutopilotPlan } from "@/lib/ai/website-autopilot";
import { saveAutopilotRun } from "@/lib/db";
import { getWordPressAutopilotStatus } from "@/lib/wordpress";
import { isRecord, jsonError, jsonOk, logApiError, parseJsonBody } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import type { AutopilotPageType } from "@/lib/types";
import type { LeadGoal, WebsiteAutopilotPlanInput } from "@/lib/ai/website-autopilot";

/**
 * Dry-run only: generates a Website Autopilot plan for the Command Center UI,
 * then logs a run-history entry (score/summary/counts + a compact top-changes
 * snapshot) via saveAutopilotRun so the MLO can see history later — it never
 * persists the full change records, and never touches WordPress.
 * getWordPressAutopilotStatus() is a local env-var read used only to show
 * the "dry-run/off" badge, never a live request.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 4000;
const PAGE_TYPES = new Set<AutopilotPageType>(["profile", "landing_page", "seo", "chatbot", "lead_form"]);
const LEAD_GOALS = new Set<LeadGoal>(["buyer", "seller", "refinance", "all"]);

function optionalString(value: unknown, max = MAX_TEXT_LENGTH): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Sign in to use the Website Autopilot Command Center.", 401, "UNAUTHENTICATED");

    const limited = rateLimit(`autopilot-plan:${clientKey(request)}`, 20, 60_000);
    if (!limited.ok) {
      return jsonError("Too many plan requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }

    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    const data = parsed.data;
    if (!isRecord(data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");

    const pageType = typeof data.pageType === "string" ? (data.pageType as AutopilotPageType) : undefined;
    if (!pageType || !PAGE_TYPES.has(pageType)) {
      return jsonError(
        "pageType must be one of profile, landing_page, seo, chatbot, lead_form.",
        400,
        "INVALID_PAGE_TYPE",
      );
    }

    const leadGoalRaw = typeof data.leadGoal === "string" ? (data.leadGoal as LeadGoal) : undefined;
    const leadGoal = leadGoalRaw && LEAD_GOALS.has(leadGoalRaw) ? leadGoalRaw : undefined;

    const planInput: WebsiteAutopilotPlanInput = {
      userId: session.sub,
      pageType,
      targetAudience: optionalString(data.targetAudience, 200),
      marketCity: optionalString(data.marketCity, 200),
      marketState: optionalString(data.marketState, 100),
      leadGoal,
      currentCopy: optionalString(data.currentCopy),
      currentChatbotIntro: optionalString(data.currentChatbotIntro),
      existingSeoTitle: optionalString(data.existingSeoTitle, 200),
      existingMetaDescription: optionalString(data.existingMetaDescription, 400),
    };

    const plan = generateWebsiteAutopilotPlan(planInput);
    const pageLabel = optionalString(data.pageLabel, 300);
    const wordpress = getWordPressAutopilotStatus();

    const run = buildAutopilotRunRecord(plan, pageType, {
      userId: session.sub,
      pageLabel,
      wordpressLive: wordpress.enabled,
    });
    saveAutopilotRun(run);

    return jsonOk({
      dryRun: true,
      pageLabel,
      plan,
      runId: run.id,
      wordpress: {
        enabled: wordpress.enabled,
        autoApplyLowRisk: wordpress.autoApplyLowRisk,
        configured: wordpress.configured,
      },
    });
  } catch (error) {
    logApiError("/api/autopilot/plan", error);
    return jsonError("Failed to generate the Website Autopilot plan.", 500, "AUTOPILOT_PLAN_FAILED");
  }
}
