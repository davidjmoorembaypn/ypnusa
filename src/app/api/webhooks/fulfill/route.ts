import { applyFulfillmentEvent, type FulfillmentPayload } from "@/lib/fulfillment";
import {
  isRecord,
  jsonError,
  jsonOk,
  logApiError,
  parseJsonBody,
  requireInternalSecret,
} from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Receives verified Stripe fulfillment events forwarded by a trusted internal
 * caller (an AWS Lambda, or any future forwarder) that owns Stripe webhook
 * signature verification — this route never talks to Stripe directly, it only
 * trusts a payload signed with LAMBDA_FULFILLMENT_SECRET. For the app to verify
 * Stripe's signature itself instead, see /api/webhooks/stripe.
 *
 * The actual event-application logic lives in @/lib/fulfillment, shared with
 * that direct-Stripe front door.
 */
export async function POST(request: Request) {
  const unauthorized = requireInternalSecret(request);
  if (unauthorized) return unauthorized;

  const limited = enforceRateLimit(request, {
    scope: "webhook-fulfill",
    limit: 30,
    message: "Too many fulfillment requests — please slow down and try again shortly.",
  });
  if (limited) return limited;

  try {
    const parsed = await parseJsonBody<FulfillmentPayload>(request);
    if (!parsed.ok) return jsonError(parsed.error, 400, parsed.code);
    if (!isRecord(parsed.data)) {
      return jsonError("Request body must be a JSON object.", 400, "INVALID_BODY");
    }

    const result = applyFulfillmentEvent(parsed.data);
    if (!result.ok) return jsonError(result.error, result.code === "UNRECOGNIZED_STRIPE_PRICE" ? 422 : 400, result.code);
    if (!result.applied) return jsonOk({ applied: false, reason: result.reason });

    return jsonOk(
      {
        applied: true,
        subscriptionId: result.subscriptionId,
        tier: result.tier,
        status: result.status,
        zipClaimed: result.zipClaimed,
        zipConflict: result.zipConflict,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (error) {
    logApiError("/api/webhooks/fulfill", error);
    return jsonError("Fulfillment processing failed.", 500, "FULFILLMENT_FAILED");
  }
}
