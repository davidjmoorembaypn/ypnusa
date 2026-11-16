import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { connectCrm, crmConnectionView, disconnectCrm } from "@/lib/integrations/crm/link";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/integrations/crm: the signed-in officer's CRM link and its recent events. */
export async function GET() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to see your CRM link.", 401, "UNAUTHENTICATED");
  try {
    return NextResponse.json({ ok: true, ...crmConnectionView(session.sub) });
  } catch (error) {
    logApiError("/api/integrations/crm GET", error);
    return jsonError("Couldn't load your CRM link.", 500, "CRM_LINK_FAILED");
  }
}

/**
 * POST /api/integrations/crm { url }: connect (or reconnect) the officer's CRM. The signing
 * secret and inbound token come back in this response only.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return jsonError("Sign in to connect your CRM.", 401, "UNAUTHENTICATED");
  const limited = rateLimit(`crm-connect:${session.sub}:${clientKey(request)}`, 10, 60 * 60_000);
  if (!limited.ok) return jsonError("Too many tries. Wait a few minutes.", 429, "RATE_LIMITED");
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    if (!isRecord(parsed.data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    const result = await connectCrm(session.sub, parsed.data.url);
    if (!result.ok) return jsonError(result.error, 400, "INVALID_URL");
    return NextResponse.json(
      {
        ok: true,
        connectionId: result.connectionId,
        signingSecret: result.signingSecret,
        inboundToken: result.inboundToken,
        link: crmConnectionView(session.sub),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logApiError("/api/integrations/crm POST", error);
    return jsonError("Couldn't connect your CRM. Try again.", 500, "CRM_CONNECT_FAILED");
  }
}

/** DELETE /api/integrations/crm: disconnect. Leads stop going out and the token stops working. */
export async function DELETE() {
  const session = await getSession();
  if (!session) return jsonError("Sign in to change your CRM link.", 401, "UNAUTHENTICATED");
  try {
    disconnectCrm(session.sub);
    return NextResponse.json({ ok: true, connected: false });
  } catch (error) {
    logApiError("/api/integrations/crm DELETE", error);
    return jsonError("Couldn't disconnect. Try again.", 500, "CRM_DISCONNECT_FAILED");
  }
}
