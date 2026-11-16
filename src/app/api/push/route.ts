import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { hasSubscription, removeSubscription, saveSubscription, vapidKeys } from "@/lib/push";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/push: the public key browsers need to subscribe, and whether this officer has alerts on anywhere. */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to set up alerts.", 401, "UNAUTHENTICATED");
  try {
    return NextResponse.json({ ok: true, publicKey: vapidKeys().publicKey, enabled: hasSubscription(session.sub) });
  } catch (error) {
    logApiError("/api/push GET", error);
    return jsonError("Alerts aren't available right now.", 500, "PUSH_UNAVAILABLE");
  }
}

/** POST /api/push { subscription }: turn alerts on for this browser. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to set up alerts.", 401, "UNAUTHENTICATED");
  const limited = rateLimit(`push:${session.sub}:${clientKey(request)}`, 10, 60_000);
  if (!limited.ok) return jsonError("Too many tries. Wait a moment.", 429, "RATE_LIMITED");
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    if (!isRecord(parsed.data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    const result = saveSubscription(session.sub, parsed.data.subscription);
    if (!result.ok) return jsonError(result.error, 400, "INVALID_SUBSCRIPTION");
    return NextResponse.json({ ok: true, enabled: true });
  } catch (error) {
    logApiError("/api/push POST", error);
    return jsonError("Couldn't turn on alerts. Try again.", 500, "PUSH_SUBSCRIBE_FAILED");
  }
}

/** DELETE /api/push { endpoint }: turn alerts off for this browser. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to change alerts.", 401, "UNAUTHENTICATED");
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    if (isRecord(parsed.data)) removeSubscription(session.sub, parsed.data.endpoint);
    return NextResponse.json({ ok: true, enabled: hasSubscription(session.sub) });
  } catch (error) {
    logApiError("/api/push DELETE", error);
    return jsonError("Couldn't turn off alerts. Try again.", 500, "PUSH_UNSUBSCRIBE_FAILED");
  }
}
