/**
 * Tier ids are stable storage keys (existing subscriptions, SSO claims, Stripe metadata).
 * Since the November 2026 lineup the public names and prices differ from the ids:
 *   id "growth" = Pro $99, id "pro" = Growth $199, id "elite" = Exclusive $299.
 * priceMonthlyCents stays at what existing subscribers are billed ($99.99 / $199.99 / $299.99)
 * so revenue and LTV figures don't drop; new checkouts use the November 2026 Stripe links
 * (src/lib/checkout.ts) and the webhook translates their tier names (src/lib/stripe-webhook.ts).
 */
export type PricingTierId = "free" | "starter" | "growth" | "pro" | "elite";

export interface PricingTier {
  id: PricingTierId;
  name: string;
  price: string;
  priceMonthlyCents: number;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight: boolean;
  zipCapacity: number | "unlimited";
  zipCapacityLabel: string;
  countyCapacityNote: string;
  capacityNote: string;
  /** 0 for tiers with no trial (free has nothing to trial; paid tiers all share one trial length). */
  trialDays: number;
}

/** Every paid tier gets the same trial length — see TRIAL_DAYS usage in entitlements.ts. */
export const TRIAL_DAYS = 15;

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceMonthlyCents: 0,
    cadence: "forever / no card",
    tagline: "Run Cerebro and prove demand before you pay anything",
    features: [
      "Cerebro AI growth diagnostic",
      "AI borrower intake assistant",
      "Qualification + scoring",
      "Explore the borrower intake experience",
      "Does NOT lock a ZIP code: anyone can take yours until you make a first payment on a paid plan",
    ],
    cta: "Start free",
    highlight: false,
    zipCapacity: 0,
    zipCapacityLabel: "No ZIP code lock (paid plans only)",
    countyCapacityNote: "No county expansion",
    capacityNote: "Cerebro + intake only — no ZIP-code-exclusive lead delivery until you upgrade",
    trialDays: 0,
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29.99",
    priceMonthlyCents: 2999,
    cadence: "/mo",
    tagline: "Lock your first exclusive ZIP code",
    features: [
      "1 included exclusive ZIP code",
      "AI intake + follow-up",
      "Territory demand reports",
      "15-day free trial to try the tools",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP code",
    countyCapacityNote: "Additional ZIP codes available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP code — additional ZIP codes are separate paid add-ons",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "growth",
    name: "Pro",
    price: "$99",
    priceMonthlyCents: 9999,
    cadence: "/mo",
    tagline: "Lock your exclusive ZIP code and go live",
    features: [
      "1 included exclusive ZIP code",
      "Higher automation run limits",
      "SMS + email nurture ladders",
      "Calendar booking + CRM mirroring",
      "15-day free trial to try the tools",
    ],
    cta: "Start 15-day trial",
    highlight: true,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP code",
    countyCapacityNote: "Additional ZIP codes available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP code — higher plans buy more automation, not more included ZIP codes",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "pro",
    name: "Growth",
    price: "$199",
    priceMonthlyCents: 19999,
    cadence: "/mo",
    tagline: "For the serious loan officer",
    features: [
      "1 included exclusive ZIP code",
      "Portable MLO website",
      "Priority lead delivery",
      "Advanced life-event signals",
      "15-day free trial to try the tools",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP code",
    countyCapacityNote: "Additional ZIP codes available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP code — higher plans buy more capability, not more included ZIP codes",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "elite",
    name: "Exclusive",
    price: "$299",
    priceMonthlyCents: 29999,
    cadence: "/mo",
    tagline: "Maximum automation and priority support",
    features: [
      "1 included exclusive ZIP code",
      "Priority territory add-on access",
      "Unlimited automation runs",
      "White-glove onboarding",
      "15-day free trial to try the tools",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP code",
    countyCapacityNote: "Priority access to additional ZIP code add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP code — priority access when adding more",
    trialDays: TRIAL_DAYS,
  },
];

/** The three plans sold today, by tier id (id "growth" = Pro, "pro" = Growth, "elite" = Exclusive). */
export type CurrentPaidTierId = "growth" | "pro" | "elite";

export const CURRENT_PAID_TIER_IDS: readonly CurrentPaidTierId[] = ["growth", "pro", "elite"];

/**
 * What new customers pay per month, in cents ($99 / $199 / $299). priceMonthlyCents above
 * keeps legacy subscribers' $x.99 billing; marketing math (yearly cost, 5-year comparison,
 * ROI calculator) uses these whole-dollar prices, which match the Stripe Payment Links.
 */
export const PUBLIC_MONTHLY_PRICE_CENTS: Readonly<Record<CurrentPaidTierId, number>> = {
  growth: 9900,
  pro: 19900,
  elite: 29900,
};

/** Years a 5-year prepaid plan covers: plan access and the ZIP code lock, from the payment date. */
export const PREPAID_5Y_YEARS = 5;

/** Days after purchase in which a 5-year prepaid plan can be refunded in full (none after). */
export const PREPAID_5Y_REFUND_WINDOW_DAYS = 30;

export interface Prepaid5yPlan {
  tierId: CurrentPaidTierId;
  /** One-time price, in cents. */
  priceCents: number;
  /** The same 5 years paid monthly at PUBLIC_MONTHLY_PRICE_CENTS, in cents. */
  monthlyEquivalentCents: number;
}

/**
 * 5-year prepaid plans: one payment locks the ZIP code for 5 years from the payment date.
 * Shared by the /pricing copy and the ROI calculator so the numbers can't drift apart.
 */
export const PREPAID_5Y: Readonly<Record<CurrentPaidTierId, Prepaid5yPlan>> = {
  growth: { tierId: "growth", priceCents: 399900, monthlyEquivalentCents: PUBLIC_MONTHLY_PRICE_CENTS.growth * 12 * PREPAID_5Y_YEARS },
  pro: { tierId: "pro", priceCents: 799900, monthlyEquivalentCents: PUBLIC_MONTHLY_PRICE_CENTS.pro * 12 * PREPAID_5Y_YEARS },
  elite: { tierId: "elite", priceCents: 1199900, monthlyEquivalentCents: PUBLIC_MONTHLY_PRICE_CENTS.elite * 12 * PREPAID_5Y_YEARS },
};

/** Share of the monthly-billing total a 5-year prepaid plan saves (0..1). */
export function prepaid5ySavingsRatio(tierId: CurrentPaidTierId): number {
  const plan = PREPAID_5Y[tierId];
  return (plan.monthlyEquivalentCents - plan.priceCents) / plan.monthlyEquivalentCents;
}

export const PAID_PRICING_TIERS = PRICING_TIERS.filter((tier) => tier.priceMonthlyCents > 0);

// Keep the legacy Starter identifier for existing subscriptions and signed SSO
// claims, but do not offer the retired $29.99 tier to new customers.
export const PUBLIC_PRICING_TIERS = PRICING_TIERS.filter((tier) => tier.id !== "starter");

/** Tiers in ascending order of capability — index comparison powers `tierAtLeast` in entitlements.ts. */
export const PRICING_TIER_ORDER: readonly PricingTierId[] = ["free", "starter", "growth", "pro", "elite"];

export function getPricingTier(id: PricingTierId): PricingTier {
  const tier = PRICING_TIERS.find((candidate) => candidate.id === id);
  if (!tier) {
    throw new Error(`Unknown pricing tier: ${id}`);
  }
  return tier;
}

export function isPricingTierId(value: unknown): value is PricingTierId {
  return typeof value === "string" && PRICING_TIER_ORDER.includes(value as PricingTierId);
}

/**
 * Maps a Stripe price/product id to a paid tier via env vars, for the Lambda
 * fulfillment webhook (src/app/api/webhooks/fulfill/route.ts). Configure whichever
 * identifier the checkout event actually carries — priceId is preferred; productId is
 * a fallback for a setup keyed by product instead of price. Returns null (never "free")
 * when nothing is configured or nothing matches, so an unrecognized id fails the request
 * instead of silently provisioning the wrong tier.
 */
export function resolveTierFromStripeIdentifier(
  priceId: string | undefined,
  productId: string | undefined,
): PricingTierId | null {
  const byPriceId: Partial<Record<PricingTierId, string | undefined>> = {
    starter: process.env.STRIPE_PRICE_ID_STARTER?.trim(),
    growth: process.env.STRIPE_PRICE_ID_GROWTH?.trim(),
    pro: process.env.STRIPE_PRICE_ID_PRO?.trim(),
    elite: process.env.STRIPE_PRICE_ID_ELITE?.trim(),
  };
  const byProductId: Partial<Record<PricingTierId, string | undefined>> = {
    starter: process.env.STRIPE_PRODUCT_ID_STARTER?.trim(),
    growth: process.env.STRIPE_PRODUCT_ID_GROWTH?.trim(),
    pro: process.env.STRIPE_PRODUCT_ID_PRO?.trim(),
    elite: process.env.STRIPE_PRODUCT_ID_ELITE?.trim(),
  };

  if (priceId) {
    const match = PAID_PRICING_TIERS.find((tier) => byPriceId[tier.id] === priceId);
    if (match) return match.id;
  }
  if (productId) {
    const match = PAID_PRICING_TIERS.find((tier) => byProductId[tier.id] === productId);
    if (match) return match.id;
  }
  return null;
}
