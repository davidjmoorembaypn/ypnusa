import type { CurrentPaidTierId } from "@/lib/pricing";

/**
 * Plans sold through their own Stripe Payment Links beyond the monthly, pay-now and 5-year
 * links in src/lib/checkout.ts (prices approved by David on 2026-11-18):
 *   - pro_yearly: the Pro plan ($99/mo) billed yearly at $990. No trial, so the first
 *     payment happens at checkout and locks the ZIP code at once.
 *   - extra_zip_monthly / extra_zip_yearly: one more exclusive ZIP code for an officer who
 *     already has a plan, $79 a month or $790 a year. An add-on holds its ZIP code but never
 *     grants plan access on its own (see entitlementForEmail).
 *
 * The webhook recognises a purchase by, in order: metadata `ypnus_plan` on the checkout or
 * subscription, the Payment Link id (plink_…) on the checkout session, or the price id
 * (price_…) on the subscription. Ids below are real Stripe ids from the Dashboard, never
 * made up; a plan without a `url` is simply not offered on the site.
 */
export type StripePlanKey = "pro_yearly" | "extra_zip_monthly" | "extra_zip_yearly";

export interface StripePlan {
  key: StripePlanKey;
  /** Plan access it grants (ignored for an add-on, which grants none). */
  tier: CurrentPaidTierId;
  addon?: "extra_zip";
  /** Price as billed, in cents, and how often. */
  priceCents: number;
  interval: "month" | "year";
  /** Monthly equivalent, in cents, for revenue reporting. */
  monthlyPriceCents: number;
}

export const STRIPE_PLANS: Readonly<Record<StripePlanKey, StripePlan>> = {
  pro_yearly: { key: "pro_yearly", tier: "growth", priceCents: 99000, interval: "year", monthlyPriceCents: 8250 },
  extra_zip_monthly: {
    key: "extra_zip_monthly",
    tier: "growth",
    addon: "extra_zip",
    priceCents: 7900,
    interval: "month",
    monthlyPriceCents: 7900,
  },
  extra_zip_yearly: {
    key: "extra_zip_yearly",
    tier: "growth",
    addon: "extra_zip",
    priceCents: 79000,
    interval: "year",
    monthlyPriceCents: 6583,
  },
};

interface StripeIds {
  /** https://buy.stripe.com/… Payment Link URL. */
  url?: string;
  /** plink_… id of that Payment Link. */
  paymentLinkId?: string;
  /** price_… id the Payment Link sells. */
  priceId?: string;
}

/** Filled in from the Stripe Dashboard once each Payment Link exists. */
const STRIPE_IDS: Readonly<Record<StripePlanKey, StripeIds>> = {
  pro_yearly: {},
  extra_zip_monthly: {},
  extra_zip_yearly: {},
};

function isPlanKey(value: unknown): value is StripePlanKey {
  return typeof value === "string" && Object.hasOwn(STRIPE_PLANS, value);
}

/** Which of these plans a Stripe checkout or subscription is, if any. */
export function stripePlanFrom(input: {
  metadataPlan?: string | null;
  paymentLinkId?: string | null;
  priceId?: string | null;
}): StripePlanKey | undefined {
  const fromMetadata = input.metadataPlan?.trim().toLowerCase();
  if (isPlanKey(fromMetadata)) return fromMetadata;
  for (const key of Object.keys(STRIPE_IDS) as StripePlanKey[]) {
    const ids = STRIPE_IDS[key];
    if (input.paymentLinkId && ids.paymentLinkId === input.paymentLinkId) return key;
    if (input.priceId && ids.priceId === input.priceId) return key;
  }
  return undefined;
}

export function stripePlan(key: unknown): StripePlan | null {
  return isPlanKey(key) ? STRIPE_PLANS[key] : null;
}

/** Checkout link for a plan, with the ZIP code as Stripe's client_reference_id; null when not set up. */
export function stripePlanCheckoutUrl(key: StripePlanKey, zip?: string): string | null {
  const url = STRIPE_IDS[key].url;
  if (!url) return null;
  if (!zip) return url;
  const link = new URL(url);
  link.searchParams.set("client_reference_id", zip);
  return link.toString();
}
