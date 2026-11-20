import { NextResponse } from "next/server";
import { jsonError, logApiError } from "@/lib/http";
import { enforceRateLimit, rateLimit } from "@/lib/rate-limit";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { findOpenNeighbors } from "@/lib/zip-neighbors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 3;

/**
 * GET /api/territory/neighbors?zip=93618: up to 3 nearby ZIP codes that are still open.
 *
 * Public, like the ZIP checker, because it only returns what the checker already shows. Each call can
 * fan out to several ledger lookups, so it has a per-visitor limit and a shared one. Results are
 * nearest by distance between ZIP code centers (not "bordering"), and a ZIP code the ledger can't
 * answer for is never listed as open.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "territory-neighbors",
    limit: 12,
    message: "Too many ZIP code checks - please slow down and try again shortly.",
  });
  if (limited) return limited;
  if (!rateLimit("territory-neighbors:all", 120, 60_000).ok) {
    return jsonError("This is busy right now. Please try again shortly.", 429, "RATE_LIMITED", { headers: { "Retry-After": "30" } });
  }

  try {
    const zip = normalizeZip(new URL(request.url).searchParams.get("zip") ?? "");
    if (!isValidZip(zip)) return jsonError("Enter a 5-digit ZIP code.", 400, "INVALID_ZIP");

    const { neighbors, unknownCount } = await findOpenNeighbors(zip, { limit: MAX_RESULTS, maxCandidates: 15 });
    return NextResponse.json({ ok: true, zip, neighbors, unknownCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiError("/api/territory/neighbors", error);
    return jsonError("Nearby ZIP codes are unavailable right now.", 500, "NEIGHBORS_FAILED");
  }
}
