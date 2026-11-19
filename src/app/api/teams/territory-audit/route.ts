import { NextResponse } from "next/server";
import { jsonError, logApiError } from "@/lib/http";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import { normalizeZip } from "@/lib/territory";
import { runTerritoryAudit } from "@/lib/territory-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/teams/territory-audit?zip=93618&radius=10&officers=5
 *
 * Public (a branch manager runs it before talking to us), so it is rate limited per visitor and
 * overall, and one request looks up at most 30 ZIP codes. Read-only: it never reserves anything.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "territory-audit",
    limit: 6,
    message: "Too many audits - please wait a minute and try again.",
  });
  if (limited) return limited;
  if (!rateLimit("territory-audit:all", 40, 60_000).ok) {
    return jsonError("This is busy right now. Please try again shortly.", 429, "RATE_LIMITED", { headers: { "Retry-After": "30" } });
  }

  try {
    const params = new URL(request.url).searchParams;
    const result = await runTerritoryAudit({
      zip: normalizeZip(params.get("zip") ?? ""),
      radius: params.get("radius"),
      officers: params.get("officers"),
    });
    if (!result.ok) return jsonError(result.message, result.code === "UNKNOWN_ZIP" ? 404 : 400, result.code);
    return NextResponse.json({ ok: true, ...result.audit }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiError("/api/teams/territory-audit", error);
    return jsonError("The territory audit is unavailable right now. Please try again shortly.", 500, "AUDIT_FAILED");
  }
}
