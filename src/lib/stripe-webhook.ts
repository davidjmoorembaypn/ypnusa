import Stripe from "stripe";
import type { FulfillmentPayload } from "@/lib/fulfillment";

/**
 * Verifies a Stripe webhook payload's signature against STRIPE_WEBHOOK_SECRET
 * and returns the parsed event. `Stripe.webhooks.constructEvent` is a static
 * signature check — it does not need a configured API key/secret key, only the
 * endpoint's own signing secret (the `whsec_...` value Stripe shows when the
 * endpoint is created).
 *
 * `rawBody` must be the exact, unparsed request body text Stripe sent — this
 * route must never run the body through request.json() first, or the
 * signature check fails.
 */
export function verifyStripeWebhookEvent(rawBody: string, signatureHeader: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  if (!signatureHeader) throw new Error("Missing stripe-signature header.");
  return Stripe.webhooks.constructEvent(rawBody, signatureHeader, secret);
}

/**
 * Maps a verified Stripe event into the same FulfillmentPayload shape
 * @/lib/fulfillment already applies (used today by the internal-secret
 * forwarder route). Returns null for an event type this app doesn't act on —
 * the caller should still ack it with 200 so Stripe stops retrying.
 *
 * Tier resolution prefers Stripe metadata (every current live Payment Link
 * sets `ypnus_tier` on both the Payment Link itself — copied onto the
 * Checkout Session's own metadata — and on subscription_data.metadata —
 * copied onto the Subscription). This avoids needing to expand line_items,
 * which webhook payloads don't support. @/lib/fulfillment falls back to the
 * STRIPE_PRICE_ID_ / STRIPE_PRODUCT_ID_ env vars when no tier metadata is present.
 */
export function mapStripeEventToFulfillmentPayload(event: Stripe.Event): FulfillmentPayload | null {
  const eventCreatedAt = event.created;
  const eventId = event.id;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription !== "string" || typeof session.customer !== "string") {
        // Not a subscription checkout (e.g. a one-time payment) — nothing for the
        // territory/tier ledger to do.
        return null;
      }
      return {
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        zip: session.client_reference_id ?? undefined,
        eventType: "checkout.session.completed",
        paymentStatus: session.payment_status,
        tier: session.metadata?.ypnus_tier,
        customerEmail: session.customer_details?.email ?? session.customer_email ?? undefined,
        eventCreatedAt,
        eventId,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      const firstItem = subscription.items.data[0];
      return {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        eventType: event.type,
        subscriptionStatus: subscription.status,
        tier: subscription.metadata?.ypnus_tier,
        priceId: firstItem?.price?.id,
        productId: typeof firstItem?.price?.product === "string" ? firstItem.price.product : undefined,
        eventCreatedAt,
        eventId,
      };
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
      return {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        eventType: "customer.subscription.deleted",
        eventCreatedAt,
        eventId,
      };
    }
    default:
      return null;
  }
}
