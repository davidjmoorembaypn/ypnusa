import { NextResponse } from "next/server";
import { jsonError, logApiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkLedgerTerritory } from "@/lib/territory-ledger";
import { estimateZipDemand } from "@/lib/zip-demand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/territory/check?zip=93618: is this ZIP code open or claimed?
 * Answers from this app's own paid ledger (the single source of truth). No external call.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "territory-check",
    limit: 60,
    message: "Too many ZIP code checks - please slow down and try again shortly.",
  });
  if (limited) return limited;

  try {
    const zip = new URL(request.url).searchParams.get("zip") ?? "";
    const result = checkLedgerTerritory(zip);
    return NextResponse.json(
      {
        ok: result.ok,
        zip: result.zip,
        valid: result.valid,
        available: result.available,
        totalClaimed: result.totalClaimed,
        message: result.message,
        source: "ledger",
        city: result.city,
        state: result.state,
        signupUrl: null,
        // Informational monthly market estimate from Census survey data (see @/lib/zip-demand).
        // Never a lead count. null only when the ZIP code itself is malformed.
        demand: result.valid ? estimateZipDemand(result.zip) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logApiError("/api/territory/check", error);
    return jsonError("Territory availability is temporarily unavailable.", 500, "TERRITORY_CHECK_FAILED");
  }
}
