import { subscriptionRepository } from "@/lib/repositories";
import { subscriptionLockKey, withKeyedLock } from "@/lib/repositories/keyed-lock";
import { generateId } from "@/lib/id";
import { logApiError } from "@/lib/http";
import { PAID_PRICING_TIERS, resolveTierFromStripeIdentifier, type PricingTierId } from "@/lib/pricing";
import { isKnownZip } from "@/lib/zip-known";
import { isValidZip, normalizeZip } from "@/lib/territory";
import { stripePlan } from "@/lib/stripe-plans";
import { scheduleZipLockHook } from "@/lib/zip-scarcity";
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
  /** A plan from src/lib/stripe-plans.ts (Pro yearly, extra ZIP code add-on), when recognised. */
  plan?: unknown;
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
  /** Prepaid term in years (one-time "5-year" checkout). Sets expiresAt; the ZIP code locks at payment. */
  termYears?: unknown;
  /** PaymentIntent of a one-time prepaid checkout, kept so a refund can release the ZIP code. */
  paymentIntentId?: unknown;
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

function resolveTier(
  tierRaw: unknown,
  priceId: string | undefined,
  productId: string | undefined,
  planRaw?: unknown,
): PricingTierId | null {
  const plan = stripePlan(planRaw);
  if (plan) return plan.tier;
  const candidate = optionalText(tierRaw, 40);
  if (candidate && PAID_PRICING_TIERS.some((tier) => tier.id === candidate)) {
    return candidate as PricingTierId;
  }
  return resolveTierFromStripeIdentifier(priceId, productId);
}

/** Marks a record with what a recognised plan sells: an add-on flag and its monthly-equivalent price. */
function withPlan(record: RevenueSubscriptionRecord, planRaw: unknown): RevenueSubscriptionRecord {
  const plan = stripePlan(planRaw);
  if (!plan) return record;
  return { ...record, addon: plan.addon, monthlyPriceCents: plan.monthlyPriceCents };
}

/** An add-on grants no plan of its own, so it reports no tier (callers then leave the officer's plan alone). */
function reportedTier(record: RevenueSubscriptionRecord): PricingTierId | undefined {
  return record.addon ? undefined : record.tier;
}

/**
 * Applies one already-trusted fulfillment event to the local revenue-subscription
 * ledger. Returns a structured result rather than an HTTP response so both front
 * doors (internal-secret and direct-Stripe) can map it to their own response shape.
 */
export async function applyFulfillmentEvent(payload: FulfillmentPayload): Promise<FulfillmentResult> {
  // One event at a time per Stripe subscription: this function reads the subscription, decides,
  // then writes it, and two events for the same subscription often arrive in the same second.
  const key = requiredText(payload.stripeSubscriptionId, 200);
  return key ? withKeyedLock(subscriptionLockKey(key), () => applyFulfillmentEventLocked(payload)) : applyFulfillmentEventLocked(payload);
}

async function applyFulfillmentEventLocked(payload: FulfillmentPayload): Promise<FulfillmentResult> {
  // Every read and write of the subscription goes through the repository, so the same code runs
  // on the data file and on PostgreSQL (see @/lib/repositories).
  const subscriptions = subscriptionRepository();
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

  const existing = await subscriptions.findByStripeSubscriptionId(stripeSubscriptionId);
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
    await subscriptions.save(cancelled);
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
    const tier = resolveTier(payload.tier, priceId, productId, payload.plan);
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
    const planned = withPlan(record, payload.plan);
    await subscriptions.save(planned);
    return { ok: true, applied: true, created: !existing, subscriptionId: planned.id, tier: reportedTier(planned), status: planned.status };
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
  const tier = resolveTier(payload.tier, priceId, productId, payload.plan);
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
  // Only a real U.S. ZIP code is ever locked; a checkout carrying anything else (00000, a typo) is
  // fulfilled as a paid plan without a ZIP code, which can lock one later.
  const zipToClaim = isValidZip(requestedZip) && isKnownZip(requestedZip) ? requestedZip : null;

  // A trial checkout ($0 today, payment_status "no_payment_required") never locks a ZIP code:
  // valuable territories must not be held for free. The chosen ZIP code is remembered as
  // pendingZip and locked by the first paid invoice (lockZipOnPaidInvoice). A checkout that
  // charged today ("pay now", payment_status "paid") locks it immediately.
  const isTrialCheckout = payload.paymentStatus === "no_payment_required";
  const termYears = typeof payload.termYears === "number" && payload.termYears > 0 && payload.termYears <= 10 ? payload.termYears : undefined;
  const expiresAt = termYears
    ? new Date(new Date(eventCreatedAt * 1000).setUTCFullYear(new Date(eventCreatedAt * 1000).getUTCFullYear() + termYears)).toISOString()
    : existing?.expiresAt;
  const stripePaymentIntentId = optionalText(payload.paymentIntentId, 200) ?? existing?.stripePaymentIntentId;
  const status: RevenueSubscriptionRecord["status"] = isTrialCheckout ? "trialing" : "active";
  const pendingZip = isTrialCheckout ? (zipToClaim ?? existing?.pendingZip) : undefined;
  const record: RevenueSubscriptionRecord = existing
    ? {
        ...existing,
        tier,
        status,
        stripeCustomerId,
        ownerEmail: customerEmail ?? existing.ownerEmail,
        ownerLoId: userId ?? existing.ownerLoId,
        pendingZip,
        expiresAt,
        stripePaymentIntentId,
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
        pendingZip,
        expiresAt,
        stripePaymentIntentId,
        lastStripeEventId: eventId,
        lastStripeEventCreatedAt: eventCreatedAt,
      };
  const { record: saved, zipClaimed, zipConflict, zipNewlyLocked } = await subscriptions.saveWithZipClaim(
    withPlan(record, payload.plan),
    isTrialCheckout ? null : zipToClaim,
  );
  // Only a ZIP code that truly went from open to locked logs the neighbor alert (async, never blocks
  // this webhook). A same-customer transfer or replacement is not new scarcity.
  if (zipNewlyLocked && zipToClaim) {
    scheduleZipLockHook(zipToClaim, saved.id, "checkout");
  }
  if (zipConflict && zipToClaim) {
    // Paid, but another officer locked this ZIP code first. Flag it so the dashboard asks
    // the officer to pick an open one (see @/lib/zip-availability claimReplacementZip).
    await subscriptions.saveWithZipClaim({ ...saved, zipLockConflict: { zip: zipToClaim, at: now } }, null);
  } else if (zipClaimed && saved.zipLockConflict) {
    await subscriptions.saveWithZipClaim({ ...saved, zipLockConflict: undefined }, null);
  }
  if (zipConflict) {
    logApiError(
      "fulfillment",
      new Error(`ZIP code ${zipToClaim} was already claimed by another active subscription — left unclaimed for subscription ${record.id}.`),
    );
  }

  return {
    ok: true,
    applied: true,
    created: !existing,
    subscriptionId: saved.id,
    tier: reportedTier(saved),
    status: saved.status,
    zipClaimed,
    zipConflict,
  };
}

export interface PaidInvoiceLockResult {
  applied: boolean;
  reason?: string;
  zip?: string;
  zipClaimed?: boolean;
  zipConflict?: boolean;
}

/**
 * Locks a trial subscription's chosen ZIP code once its first real payment lands
 * (invoice.paid with amount_paid > 0). Until then the ZIP code stays open: if another
 * loan officer pays for it first, they get it and this record is flagged zipLockConflict.
 * Idempotent: a repeat delivery after the lock is a no-op.
 */
export async function lockZipOnPaidInvoice(input: {
  stripeSubscriptionId: string | undefined;
  amountPaidCents: number;
  invoiceStatus: string | null | undefined;
}): Promise<PaidInvoiceLockResult> {
  if (input.invoiceStatus !== "paid") return { applied: false, reason: "Invoice is not paid." };
  if (!(input.amountPaidCents > 0)) return { applied: false, reason: "$0 invoice (trial) does not lock a ZIP code." };
  if (!input.stripeSubscriptionId) return { applied: false, reason: "Invoice has no subscription." };
  // The same lock as applyFulfillmentEvent: an invoice and a subscription update for one
  // subscription must not read it at the same moment and overwrite each other.
  const stripeSubscriptionId = input.stripeSubscriptionId;
  return withKeyedLock(subscriptionLockKey(stripeSubscriptionId), () => lockZipOnPaidInvoiceLocked(stripeSubscriptionId));
}

async function lockZipOnPaidInvoiceLocked(stripeSubscriptionId: string): Promise<PaidInvoiceLockResult> {
  const subscriptions = subscriptionRepository();
  const existing = await subscriptions.findByStripeSubscriptionId(stripeSubscriptionId);
  if (!existing) return { applied: false, reason: "No subscription found for that invoice." };
  if (existing.status === "cancelled") return { applied: false, reason: "Subscription is cancelled." };
  const zip = existing.pendingZip;
  if (!zip) return { applied: false, reason: "No pending ZIP code to lock." };

  const paid: RevenueSubscriptionRecord = { ...existing, status: "active", pendingZip: undefined, zipLockConflict: undefined };
  const { zipClaimed, zipConflict, zipNewlyLocked } = await subscriptions.saveWithZipClaim(paid, zip);
  if (zipNewlyLocked) scheduleZipLockHook(zip, existing.id, "first_payment");
  if (zipConflict) {
    await subscriptions.saveWithZipClaim({ ...paid, zipLockConflict: { zip, at: new Date().toISOString() } }, null);
    logApiError(
      "fulfillment",
      new Error(`First payment for subscription ${existing.id} arrived, but ZIP code ${zip} was already locked by another paid subscription.`),
    );
  }
  return { applied: true, zip, zipClaimed, zipConflict };
}

