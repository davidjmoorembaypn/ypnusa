import {
  findRevenueSubscriptionByStripeSubscriptionId,
  saveRevenueSubscription,
  saveRevenueSubscriptionWithZipClaim,
} from "@/lib/db";
import { generateId } from "@/lib/id";
import { logApiError } from "@/lib/http";
import { PAID_PRICING_TIERS, resolveTierFromStripeIdentifier, type PricingTierId } from "@/lib/pricing";
import { isValidZip, normalizeZip } from "@/lib/territory";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { optionalText, requiredText } from "@/lib/validation";

/**
 * Shared core of fulfillment-event processing, used by two front doors:
 *  - /api/webhooks/fulfill — payload forwarded by a trusted internal caller
 *    (an AWS Lambda, or any future forwarder), authenticated via
 *    LAMBDA_FULFILLMENT_SECRET. Kept byte-for-byte compatible with its
 *    original contract/tests.
 *  - /api/webhooks/stripe — Stripe events verified directly against
 *    STRIPE_WEBHOOK_SECRET (see src/lib/stripe-webhook.ts), mapped into this
 *    same payload shape.
 *
 * This module never talks to Stripe itself — callers hand it already-trusted
 * (verified signature, or verified internal secret) event data.
 */

export const SUPPORTED_EVENT_TYPES = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;
export type FulfillmentEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

export function isSupportedEventType(value: unknown): value is FulfillmentEventType {
  return typeof value === "string" && SUPPORTED_EVENT_TYPES.includes(value as FulfillmentEventType);
}

/** Stripe checkout.session.completed's own payment_status field. */
const PAYMENT_STATUSES = ["paid", "unpaid", "no_payment_required"] as const;
type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

/** Stripe subscription.status values this app cares about. */
const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;
type StripeSubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

function isStripeSubscriptionStatus(value: unknown): value is StripeSubscriptionStatus {
  return typeof value === "string" && SUBSCRIPTION_STATUSES.includes(value as StripeSubscriptionStatus);
}

/**
 * Maps a Stripe subscription.status to this app's own status field.
 * past_due/incomplete still hold an active entitlement (Stripe keeps retrying
 * the card) — only a terminal state downgrades to cancelled.
 */
function mapSubscriptionStatus(status: StripeSubscriptionStatus): RevenueSubscriptionRecord["status"] {
  if (status === "trialing") return "trialing";
  if (status === "active" || status === "past_due" || status === "incomplete") return "active";
  return "cancelled";
}

export interface FulfillmentPayload {
  userId?: unknown;
  customerEmail?: unknown;
  stripeCustomerId?: unknown;
  /** The Stripe subscription id (session.subscription / subscription.id) — the actual lookup key, not stripeCustomerId. */
  stripeSubscriptionId?: unknown;
  priceId?: unknown;
  productId?: unknown;
  /**
   * A tier already known from Stripe metadata (session.metadata.ypnus_tier or
   * subscription.metadata.ypnus_tier — every current live Payment Link sets
   * this), checked before falling back to priceId/productId resolution.
   */
  tier?: unknown;
  /**
   * The ZIP territory the borrower reserved before checkout (forwarded from Stripe
   * checkout session metadata by the Lambda). Only ever locked on checkout.session.completed —
   * see `saveRevenueSubscriptionWithZipClaim`.
   */
  zip?: unknown;
  eventType?: unknown;
  /** Required only for checkout.session.completed — Stripe's own payment_status on the session object. */
  paymentStatus?: unknown;
  /** Required only for customer.subscription.created/updated — Stripe's own subscription.status. */
  subscriptionStatus?: unknown;
  /** Unix seconds — the Stripe event's own `created`, forwarded so an out-of-order/older event never overwrites newer state. */
  eventCreatedAt?: unknown;
  /** Optional Stripe event id — guards an exact-duplicate redelivery from reapplying. */
  eventId?: unknown;
}

export type FulfillmentResult =
  | { ok: true; applied: false; reason: string }
  | {
      ok: true;
      applied: true;
      created: boolean;
      subscriptionId: string;
      tier?: PricingTierId;
      status: RevenueSubscriptionRecord["status"];
      zipClaimed?: boolean;
      zipConflict?: boolean;
    }
  | { ok: false; error: string; code: string };

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

function resolveTier(tierRaw: unknown, priceId: string | undefined, productId: string | undefined): PricingTierId | null {
  const candidate = optionalText(tierRaw, 40);
  if (candidate && PAID_PRICING_TIERS.some((tier) => tier.id === candidate)) {
    return candidate as PricingTierId;
  }
  return resolveTierFromStripeIdentifier(priceId, productId);
}

/**
 * Applies one already-trusted fulfillment event to the local revenue-subscription
 * ledger. Returns a structured result rather than an HTTP response so both front
 * doors (internal-secret and direct-Stripe) can map it to their own response shape.
 */
export function applyFulfillmentEvent(payload: FulfillmentPayload): FulfillmentResult {
  const stripeCustomerId = requiredText(payload.stripeCustomerId, 200);
  const stripeSubscriptionId = requiredText(payload.stripeSubscriptionId, 200);
  const eventCreatedAt =
    typeof payload.eventCreatedAt === "number" && Number.isFinite(payload.eventCreatedAt)
      ? payload.eventCreatedAt
      : null;
  if (!stripeCustomerId || !stripeSubscriptionId || eventCreatedAt === null || !isSupportedEventType(payload.eventType)) {
    return {
      ok: false,
      error:
        "stripeCustomerId, stripeSubscriptionId, a numeric eventCreatedAt, and a supported eventType are required.",
      code: "INVALID_FULFILLMENT_PAYLOAD",
    };
  }
  const eventType = payload.eventType;
  const eventId = optionalText(payload.eventId, 200);

  const existing = findRevenueSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
  if (isStaleOrDuplicateEvent(existing, eventCreatedAt, eventId)) {
    return {
      ok: true,
      applied: false,
      reason: "Stale or already-applied event — a newer or identical event already updated this subscription.",
    };
  }

  if (eventType === "customer.subscription.deleted") {
    if (!existing) {
      return { ok: true, applied: false, reason: "No subscription found for that stripeSubscriptionId." };
    }
    const cancelled: RevenueSubscriptionRecord = {
      ...existing,
      status: "cancelled",
      lastStripeEventId: eventId,
      lastStripeEventCreatedAt: eventCreatedAt,
    };
    saveRevenueSubscription(cancelled);
    return { ok: true, applied: true, created: false, subscriptionId: cancelled.id, status: cancelled.status };
  }

  if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
    if (!isStripeSubscriptionStatus(payload.subscriptionStatus)) {
      return {
        ok: false,
        error: "subscriptionStatus (a Stripe subscription status) is required for customer.subscription.created/updated.",
        code: "INVALID_FULFILLMENT_PAYLOAD",
      };
    }
    const priceId = optionalText(payload.priceId, 200);
    const productId = optionalText(payload.productId, 200);
    const tier = resolveTier(payload.tier, priceId, productId);
    if (!tier) {
      return {
        ok: false,
        error: "Could not resolve a tier from metadata.ypnus_tier or priceId/productId.",
        code: "UNRECOGNIZED_STRIPE_PRICE",
      };
    }
    const status = mapSubscriptionStatus(payload.subscriptionStatus);
    const now = new Date().toISOString();
    const customerEmail = optionalText(payload.customerEmail, 320);
    const userId = optionalText(payload.userId, 200);
    const record: RevenueSubscriptionRecord = existing
      ? {
          ...existing,
          tier,
          status,
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
          status,
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
    return { ok: true, applied: true, created: !existing, subscriptionId: record.id, tier: record.tier, status: record.status };
  }

  // checkout.session.completed — Stripe can deliver this before payment actually clears for
  // delayed payment methods (payment_status: "unpaid"); only "paid" or "no_payment_required"
  // (e.g. a $0 trial) may activate. A later async success arrives as its own event.
  if (!isPaymentStatus(payload.paymentStatus)) {
    return {
      ok: false,
      error: "paymentStatus (paid, unpaid, or no_payment_required) is required for checkout.session.completed.",
      code: "INVALID_FULFILLMENT_PAYLOAD",
    };
  }
  if (payload.paymentStatus === "unpaid") {
    return {
      ok: true,
      applied: false,
      reason: "Checkout payment is not yet confirmed (payment_status=unpaid) — waiting for the async success event.",
    };
  }

  const priceId = optionalText(payload.priceId, 200);
  const productId = optionalText(payload.productId, 200);
  const tier = resolveTier(payload.tier, priceId, productId);
  if (!tier) {
    return {
      ok: false,
      error: "Could not resolve a tier from metadata.ypnus_tier or priceId/productId.",
      code: "UNRECOGNIZED_STRIPE_PRICE",
    };
  }

  const customerEmail = optionalText(payload.customerEmail, 320);
  const userId = optionalText(payload.userId, 200);
  const now = new Date().toISOString();
  const requestedZip = normalizeZip(payload.zip);
  const zipToClaim = isValidZip(requestedZip) ? requestedZip : null;

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
  const { zipClaimed, zipConflict } = saveRevenueSubscriptionWithZipClaim(record, zipToClaim);
  if (zipConflict) {
    logApiError(
      "fulfillment",
      new Error(`ZIP ${zipToClaim} was already claimed by another active subscription — left unclaimed for subscription ${record.id}.`),
    );
  }

  return {
    ok: true,
    applied: true,
    created: !existing,
    subscriptionId: record.id,
    tier: record.tier,
    status: record.status,
    zipClaimed,
    zipConflict,
  };
}
