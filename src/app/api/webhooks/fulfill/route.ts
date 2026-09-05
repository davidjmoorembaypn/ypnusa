import {
  findRevenueSubscriptionByStripeCustomerId,
  saveRevenueSubscription,
} from "@/lib/db";
import { generateId } from "@/lib/id";
import {
  isRecord,
  jsonError,
  jsonOk,
  logApiError,
  parseJsonBody,
  requireInternalSecret,
} from "@/lib/http";
import { resolveTierFromStripeIdentifier } from "@/lib/pricing";
import { enforceRateLimit } from "@/lib/rate-limit";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { optionalText, requiredText } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPPORTED_EVENT_TYPES = ["checkout.session.completed", "customer.subscription.deleted"] as const;
type FulfillmentEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

function isSupportedEventType(value: unknown): value is FulfillmentEventType {
  return typeof value === "string" && SUPPORTED_EVENT_TYPES.includes(value as FulfillmentEventType);
}

interface FulfillmentPayload {
  userId?: unknown;
  customerEmail?: unknown;
  stripeCustomerId?: unknown;
  priceId?: unknown;
  productId?: unknown;
  eventType?: unknown;
}

/**
 * Receives verified Stripe fulfillment events forwarded by the AWS Lambda that
 * owns Stripe webhook verification — this route never talks to Stripe directly,
 * it only trusts a payload signed with LAMBDA_FULFILLMENT_SECRET. Updates the
 * subscriber's tier/status in RevenueSubscriptionRecord, keyed by stripeCustomerId.
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

    const stripeCustomerId = requiredText(parsed.data.stripeCustomerId, 200);
    if (!stripeCustomerId || !isSupportedEventType(parsed.data.eventType)) {
      return jsonError(
        "stripeCustomerId and a supported eventType (checkout.session.completed or customer.subscription.deleted) are required.",
        400,
        "INVALID_FULFILLMENT_PAYLOAD",
      );
    }
    const eventType = parsed.data.eventType;

    const existing = findRevenueSubscriptionByStripeCustomerId(stripeCustomerId);

    if (eventType === "customer.subscription.deleted") {
      if (!existing) {
        return jsonOk({ applied: false, reason: "No subscription found for that stripeCustomerId." });
      }
      const cancelled: RevenueSubscriptionRecord = { ...existing, status: "cancelled" };
      saveRevenueSubscription(cancelled);
      return jsonOk({ applied: true, subscriptionId: cancelled.id, status: cancelled.status });
    }

    // checkout.session.completed
    const priceId = optionalText(parsed.data.priceId, 200);
    const productId = optionalText(parsed.data.productId, 200);
    const tier = resolveTierFromStripeIdentifier(priceId, productId);
    if (!tier) {
      return jsonError(
        "priceId/productId did not match any configured STRIPE_PRICE_ID_*/STRIPE_PRODUCT_ID_* tier.",
        422,
        "UNRECOGNIZED_STRIPE_PRICE",
      );
    }

    const customerEmail = optionalText(parsed.data.customerEmail, 320);
    const userId = optionalText(parsed.data.userId, 200);
    const now = new Date().toISOString();

    const record: RevenueSubscriptionRecord = existing
      ? {
          ...existing,
          tier,
          status: "active",
          ownerEmail: customerEmail ?? existing.ownerEmail,
          ownerLoId: userId ?? existing.ownerLoId,
        }
      : {
          id: generateId("sub"),
          createdAt: now,
          startedAt: now,
          tier,
          status: "active",
          source: "stripe_webhook",
          stripeCustomerId,
          ownerEmail: customerEmail,
          ownerLoId: userId,
          claimedZips: [],
        };
    saveRevenueSubscription(record);

    return jsonOk(
      { applied: true, subscriptionId: record.id, tier: record.tier, status: record.status },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    logApiError("/api/webhooks/fulfill", error);
    return jsonError("Fulfillment processing failed.", 500, "FULFILLMENT_FAILED");
  }
}
