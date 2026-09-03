import { getSession } from "@/lib/auth";
import { listAutopilotRuns } from "@/lib/db";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Read-only Website Autopilot run history for the signed-in MLO — "YPNUS
 * improved these items for you." No DB write, no WordPress/network call.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RUNS_RETURNED = 25;

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return jsonError("Sign in to view Website Autopilot run history.", 401, "UNAUTHENTICATED");

    const limited = rateLimit(`autopilot-runs:${clientKey(request)}`, 30, 60_000);
    if (!limited.ok) {
      return jsonError("Too many requests — please slow down and try again shortly.", 429, "RATE_LIMITED", {
        headers: { "Retry-After": String(limited.retryAfter) },
      });
    }

    const runs = listAutopilotRuns(session.sub).slice(0, MAX_RUNS_RETURNED);
    return jsonOk({ runs });
  } catch (error) {
    logApiError("/api/autopilot/runs", error);
    return jsonError("Failed to load Website Autopilot run history.", 500, "AUTOPILOT_RUNS_FAILED");
  }
}
