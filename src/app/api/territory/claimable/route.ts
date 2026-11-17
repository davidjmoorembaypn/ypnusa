import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, logApiError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkZipForViewer } from "@/lib/zip-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/territory/claimable?zip=93291 — can the signed-in loan officer still buy this
 * ZIP code? The upgrade panel calls this before it shows any checkout button.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "territory-claimable",
    limit: 60,
    message: "Too many ZIP code checks - please slow down and try again shortly.",
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session?.email) return jsonError("Sign in to check a ZIP code.", 401, "UNAUTHENTICATED");

  try {
    const zip = new URL(request.url).searchParams.get("zip");
    const result = checkZipForViewer({ email: session.email }, zip);
    if (!result.valid) return jsonError("Enter a 5-digit ZIP code.", 400, "INVALID_ZIP");
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logApiError("/api/territory/claimable", error);
    return jsonError("ZIP code availability is unavailable right now. Please try again shortly.", 500, "CHECK_FAILED");
  }
}
