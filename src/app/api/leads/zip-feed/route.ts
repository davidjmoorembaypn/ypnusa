import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, logApiError } from "@/lib/http";
import { buildZipLeadFeed, defaultFeedZip } from "@/lib/lead-feed";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/leads/zip-feed?zip=93291 — the signed-in loan officer's ZIP code lead feed.
 * Contact details are removed here, on the server, for every request the viewer doesn't own
 * (see src/lib/lead-feed.ts). Without ?zip the feed opens on the viewer's own ZIP code.
 */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    scope: "zip-lead-feed",
    limit: 60,
    message: "Too many requests - please slow down and try again shortly.",
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session?.email) return jsonError("Sign in to see your ZIP code feed.", 401, "UNAUTHENTICATED");

  try {
    const viewer = { userId: session.sub, email: session.email };
    const requested = new URL(request.url).searchParams.get("zip");
    const zip = requested ?? defaultFeedZip(viewer);
    if (!zip) {
      return NextResponse.json({ ok: true, feed: null }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const feed = buildZipLeadFeed(viewer, zip);
    if (!feed) return jsonError("Enter a 5-digit ZIP code.", 400, "INVALID_ZIP");
    return NextResponse.json({ ok: true, feed }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logApiError("/api/leads/zip-feed", error);
    return jsonError("The lead feed is unavailable right now. Please try again shortly.", 500, "FEED_FAILED");
  }
}
