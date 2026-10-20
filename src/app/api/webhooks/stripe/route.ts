import { applyFulfillmentEvent } from "@/lib/fulfillment";
import { jsonError, jsonOk, logApiError } from "@/lib/http";
import { mapStripeEventToFulfillmentPayload, verifyStripeWebhookEvent } from "@/lib/stripe-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Direct Stripe → this app webhook. Verifies Stripe's own signature against
 * STRIPE_WEBHOOK_SECRET (no Lambda or other forwarder in the path) and applies
 * the event through the same @/lib/fulfillment core /api/webhooks/fulfill uses.
 *
 * This is ADDITIVE: it mirrors events into this app's own revenue-subscription
 * ledger (src/lib/territory.ts already folds active/trialing subscriptions into
 * ZIP-claim checks) alongside — not instead of — WordPress's existing Stripe
 * webhook, which remains the live production entitlement system until that's
 * explicitly decided otherwise. Nothing here disables or replaces it.
 *
 * Always acks with 200 once the signature verifies, even for an event type
 * this app ignores or a business-logic rejection (e.g. unrecognized price) —
 * only a bad/missing signature gets a non-200, so Stripe doesn't retry-storm
 * on cases that will never succeed.
 */
export async function POST(request: Request) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (error) {
    logApiError("/api/webhooks/stripe", error);
    return jsonError("Could not read request body.", 400, "INVALID_BODY");
  }

  let event;
  try {
    event = verifyStripeWebhookEvent(rawBody, request.headers.get("stripe-signature"));
  } catch (error) {
    logApiError("/api/webhooks/stripe", error);
    return jsonError("Signature verification failed.", 400, "INVALID_SIGNATURE");
  }

  try {
    const payload = mapStripeEventToFulfillmentPayload(event);
    if (!payload) {
      return jsonOk({ applied: false, reason: `Event type ${event.type} is not acted on.` });
    }

    const result = applyFulfillmentEvent(payload);
    if (!result.ok) {
      // A business-logic rejection (bad payload shape, unrecognized price) is
      // logged for follow-up but still acked 200 — Stripe would otherwise
      // retry a request that will never succeed.
      logApiError("/api/webhooks/stripe", new Error(`${result.code}: ${result.error}`));
      return jsonOk({ applied: false, reason: result.error });
    }
    if (!result.applied) {
      return jsonOk({ applied: false, reason: result.reason });
    }
    return jsonOk({
      applied: true,
      subscriptionId: result.subscriptionId,
      tier: result.tier,
      status: result.status,
      zipClaimed: result.zipClaimed,
      zipConflict: result.zipConflict,
    });
  } catch (error) {
    logApiError("/api/webhooks/stripe", error);
    // Still ack — an unexpected error here should not spin Stripe into endless
    // retries against a route that logs and can be fixed forward.
    return jsonOk({ applied: false, reason: "Internal error while applying the event." });
  }
}
