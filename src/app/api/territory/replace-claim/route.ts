import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { claimReplacementZip } from "@/lib/zip-availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/territory/replace-claim { zip } — for a paid plan whose ZIP code another
 * officer locked first: locks an open ZIP code of the officer's choice instead.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.email) return jsonError("Sign in to pick your ZIP code.", 401, "UNAUTHENTICATED");

  const limited = rateLimit(`replace-claim:${session.sub}`, 20, 60_000);
  if (!limited.ok) {
    return jsonError("Too many tries - please wait a moment and try again.", 429, "RATE_LIMITED", {
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok || !isRecord(parsed.data)) return jsonError("Enter a 5-digit ZIP code.", 400, "INVALID_BODY");
    const result = claimReplacementZip({ email: session.email }, parsed.data.zip);
    if (result.ok) return NextResponse.json({ ok: true, zip: result.zip }, { headers: { "Cache-Control": "no-store" } });
    if (result.reason === "invalid_zip") return jsonError("Enter a 5-digit ZIP code.", 400, "INVALID_ZIP");
    if (result.reason === "no_conflict") return jsonError("There's no ZIP code to replace on your plan.", 409, "NO_CONFLICT");
    return NextResponse.json(
      { ok: false, error: "That ZIP code is taken. Try one of the open ones nearby.", code: "ZIP_TAKEN", nearby: result.nearby ?? [] },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logApiError("/api/territory/replace-claim", error);
    return jsonError("Couldn't lock that ZIP code right now. Please try again shortly.", 500, "CLAIM_FAILED");
  }
}
