import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, logApiError } from "@/lib/http";
import { crmConnectionView, deliverCrmEvent, queueCrmEvent } from "@/lib/integrations/crm/link";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/integrations/crm/test: sends a sample lead (made-up details) to the officer's CRM. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to test your CRM link.", 401, "UNAUTHENTICATED");
  const limited = rateLimit(`crm-test:${session.sub}:${clientKey(request)}`, 5, 60_000);
  if (!limited.ok) return jsonError("Too many tests. Wait a minute.", 429, "RATE_LIMITED");
  try {
    const queued = queueCrmEvent(session.sub, "test", undefined, { sendNow: false });
    if (!queued) return jsonError("Connect your CRM first.", 400, "NOT_CONNECTED");
    // Send here and wait, so the officer sees whether it arrived.
    await deliverCrmEvent(queued.id);
    const view = crmConnectionView(session.sub);
    const delivery = view.recentDeliveries.find((item) => item.id === queued.id) ?? null;
    return NextResponse.json({ ok: true, delivery, link: view });
  } catch (error) {
    logApiError("/api/integrations/crm/test", error);
    return jsonError("Couldn't send the test. Try again.", 500, "CRM_TEST_FAILED");
  }
}
