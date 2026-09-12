import {
  findRevenueSubscriptionByStripeSubscriptionId,
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

/** Stripe checkout.session.completed's own payment_status field. */
const PAYMENT_STATUSES = ["paid", "unpaid", "no_payment_required"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

interface FulfillmentPayload {
  userId?: unknown;
  customerEmail?: unknown;
  stripeCustomerId?: unknown;
  /** The Stripe subscription id (session.subscription / subscription.id) — the actual lookup key, not stripeCustomerId. */
  stripeSubscriptionId?: unknown;
  priceId?: unknown;
  productId?: unknown;
  eventType?: unknown;
  /** Required only for checkout.session.completed — Stripe's own payment_status on the session object. */
  paymentStatus?: unknown;
  /** Unix seconds — the Stripe event's own `created`, forwarded so an out-of-order/older event never overwrites newer state. */
  eventCreatedAt?: unknown;
  /** Optional Stripe event id — guards an exact-duplicate redelivery from reapplying. */
  eventId?: unknown;
}

/** True when applying `eventCreatedAt`/`eventId` to `existing` would go backwards or replay an already-applied event. */
function isStaleOrDuplicateEvent(
  existing: RevenueSubscriptionRecord | null,
  eventCreatedAt: number,
  eventId: string | undefined,
): boolean {
  if (!existing) return false;
  if (eventId && existing.lastStripeEventId === eventId) return true;
  return (
    typeof existing.lastStripeEventCreatedAt === "number" &&
    eventCreatedAt < existing.lastStripeEventCreatedAt
  );
}

/**
 * Receives verified Stripe fulfillment events forwarded by the AWS Lambda that
 * owns Stripe webhook verification — this route never talks to Stripe directly,
 * it only trusts a payload signed with LAMBDA_FULFILLMENT_SECRET. Updates the
 * subscriber's tier/status in RevenueSubscriptionRecord, keyed by stripeSubscriptionId.
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
    const stripeSubscriptionId = requiredText(parsed.data.stripeSubscriptionId, 200);
    const eventCreatedAt =
      typeof parsed.data.eventCreatedAt === "number" && Number.isFinite(parsed.data.eventCreatedAt)
        ? parsed.data.eventCreatedAt
        : null;
    if (!stripeCustomerId || !stripeSubscriptionId || eventCreatedAt === null || !isSupportedEventType(parsed.data.eventType)) {
      return jsonError(
        "stripeCustomerId, stripeSubscriptionId, a numeric eventCreatedAt, and a supported eventType (checkout.session.completed or customer.subscription.deleted) are required.",
        400,
        "INVALID_FULFILLMENT_PAYLOAD",
      );
    }
    const eventType = parsed.data.eventType;
    const eventId = optionalText(parsed.data.eventId, 200);

    const existing = findRevenueSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    if (isStaleOrDuplicateEvent(existing, eventCreatedAt, eventId)) {
      return jsonOk({
        applied: false,
        reason: "Stale or already-applied event — a newer or identical event already updated this subscription.",
      });
    }

    if (eventType === "customer.subscription.deleted") {
      if (!existing) {
        return jsonOk({ applied: false, reason: "No subscription found for that stripeSubscriptionId." });
      }
      const cancelled: RevenueSubscriptionRecord = {
        ...existing,
        status: "cancelled",
        lastStripeEventId: eventId,
        lastStripeEventCreatedAt: eventCreatedAt,
      };
      saveRevenueSubscription(cancelled);
      return jsonOk({ applied: true, subscriptionId: cancelled.id, status: cancelled.status });
    }

    // checkout.session.completed — Stripe can deliver this before payment actually clears for
    // delayed payment methods (payment_status: "unpaid"); only "paid" or "no_payment_required"
    // (e.g. a $0 trial) may activate. A later async success arrives as its own event.
    if (!isPaymentStatus(parsed.data.paymentStatus)) {
      return jsonError(
        "paymentStatus (paid, unpaid, or no_payment_required) is required for checkout.session.completed.",
        400,
        "INVALID_FULFILLMENT_PAYLOAD",
      );
    }
    if (parsed.data.paymentStatus === "unpaid") {
      return jsonOk({
        applied: false,
        reason: "Checkout payment is not yet confirmed (payment_status=unpaid) — waiting for the async success event.",
      });
    }

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
          stripeCustomerId,
          ownerEmail: customerEmail ?? existing.ownerEmail,
          ownerLoId: userId ?? existing.ownerLoId,
          lastStripeEventId: eventId,
          lastStripeEventCreatedAt: eventCreatedAt,
        }
      : {
          id: generateId("sub"),
          createdAt: now,
          startedAt: now,
          tier,
          status: "active",
          source: "stripe_webhook",
          stripeCustomerId,
          stripeSubscriptionId,
          ownerEmail: customerEmail,
          ownerLoId: userId,
          claimedZips: [],
          lastStripeEventId: eventId,
          lastStripeEventCreatedAt: eventCreatedAt,
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
