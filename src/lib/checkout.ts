import { marketingUrl } from "@/lib/site";
import type { PricingTierId } from "@/lib/pricing";

/**
 * Resolves where a pricing CTA should actually send someone.
 *
 * This app never hardcodes or invents a Stripe price ID or Payment Link —
 * there is no Stripe SDK/checkout-session code in this repo at all (see
 * docs/sso-handoff.md's "Billing" section and wp-plugins/ypnus-stripe-webhook
 * for why: Stripe billing is owned entirely by ypnus.com's WordPress plugin).
 *
 * Default behavior (no env vars set): every tier routes to
 * `ypnus.com/lo-signup.html?plan=<tier>`, exactly as it already does today —
 * that page/WordPress resolves the actual Stripe Payment Link per plan.
 *
 * Optional enhancement: if `NEXT_PUBLIC_STRIPE_PAYMENT_LINK_<TIER>` is set
 * for a paid tier, that exact URL is used instead — letting app.ypnus.com
 * link straight to Stripe Checkout without a hop through WordPress, for
 * whichever plans the business wants to configure that way. The value must
 * be a real, already-created Stripe Payment Link URL (from the Stripe
 * Dashboard) — this module only ever reads it from the environment, never
 * constructs or guesses one.
 */
const PAYMENT_LINK_ENV_VARS: Record<Exclude<PricingTierId, "free">, string> = {
  starter: "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER",
  growth: "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_GROWTH",
  pro: "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO",
  elite: "NEXT_PUBLIC_STRIPE_PAYMENT_LINK_ELITE",
};

function configuredPaymentLink(tier: PricingTierId): string | null {
  if (tier === "free") return null;
  const envVar = PAYMENT_LINK_ENV_VARS[tier];
  const value = process.env[envVar]?.trim();
  return value || null;
}

/**
 * `zip`, when given, carries a ZIP a visitor already checked (via TerritoryClaim)
 * through to signup so the territory they reserved is the one that gets locked —
 * mirrors signupHrefFor's zip passthrough in territory-claim.tsx. Only applied to
 * the lo-signup.html fallback: a direct Stripe Payment Link doesn't read query
 * params, so zip continuity there stays entirely on the WordPress/Stripe side.
 */
export function checkoutUrlForTier(tier: PricingTierId, zip?: string): string {
  const direct = configuredPaymentLink(tier);
  if (direct) return direct;
  const params = new URLSearchParams({ plan: tier });
  if (zip) params.set("zip", zip);
  return marketingUrl(`/lo-signup.html?${params.toString()}`);
}

/** True when a direct Stripe Payment Link is configured for this tier (vs. falling back to lo-signup.html). */
export function hasDirectCheckoutLink(tier: PricingTierId): boolean {
  return configuredPaymentLink(tier) !== null;
}
