import { NextResponse } from "next/server";
import { isRecord, jsonError, logApiError, parseJsonBody } from "@/lib/http";
import { applyCrmUpdate } from "@/lib/integrations/crm/inbound";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFrom(request: Request): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return request.headers.get("x-ypn-token")?.trim() || null;
}

/**
 * POST /api/webhooks/crm/{connectionId}: a status change or note from an officer's CRM.
 * Header: Authorization: Bearer <inbound token> (or X-YPN-Token). Body:
 * { leadId?, externalId?, status?, note?, updatedAt?, eventId? }. Never creates a lead.
 */
export async function POST(request: Request, context: { params: Promise<{ connectionId: string }> }) {
  const { connectionId } = await context.params;
  const limited = rateLimit(`crm-inbound:${connectionId}:${clientKey(request)}`, 60, 60_000);
  if (!limited.ok) return jsonError("Too many updates. Slow down and try again.", 429, "RATE_LIMITED");
  try {
    const parsed = await parseJsonBody(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code ?? "INVALID_JSON");
    if (!isRecord(parsed.data)) return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    const result = applyCrmUpdate(connectionId, tokenFrom(request), parsed.data);
    if (!result.ok) return jsonError(result.error, result.status, result.code);
    return NextResponse.json(result);
  } catch (error) {
    logApiError("/api/webhooks/crm", error);
    return jsonError("Couldn't apply the update.", 500, "CRM_UPDATE_FAILED");
  }
}
