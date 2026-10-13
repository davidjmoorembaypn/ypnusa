import type { PricingTierId } from "@/lib/pricing";

/**
 * Direct Stripe Payment Links keep paid conversion independent from WordPress.
 * Environment variables may override these verified production links without a code change.
 */
const PAYMENT_LINKS: Record<Exclude<PricingTierId, "free">, string> = {
  starter:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER?.trim() ||
    "https://buy.stripe.com/14A6oG4ZQ3xf31T5CC3AY0I",
  growth:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_GROWTH?.trim() ||
    "https://buy.stripe.com/14A6oG4ZQ3xf31T5CC3AY0I",
  pro:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO?.trim() ||
    "https://buy.stripe.com/4gM3cu8c2aZHcCt3uu3AY0J",
  elite:
    process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ELITE?.trim() ||
    "https://buy.stripe.com/dRmcN43VM9VDeKBfdc3AY0K",
};

export function checkoutUrlForTier(tier: PricingTierId, zip?: string): string {
  if (tier === "free") {
    const params = new URLSearchParams({ plan: "free" });
    if (zip) params.set("zip", zip);
    return `/signup?${params.toString()}`;
  }

  const url = new URL(PAYMENT_LINKS[tier]);
  if (zip) url.searchParams.set("client_reference_id", zip);
  return url.toString();
}

export function hasDirectCheckoutLink(tier: PricingTierId): boolean {
  return tier !== "free";
}
