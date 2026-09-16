export type PricingTierId = "free" | "pro" | "growth" | "exclusive";

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
      "Live lead delivery begins on a paid plan",
    ],
    cta: "Start free",
    highlight: false,
    zipCapacity: 0,
    zipCapacityLabel: "No exclusive ZIP yet",
    countyCapacityNote: "No county expansion",
    capacityNote: "Cerebro + intake only — no ZIP-exclusive lead delivery until you upgrade",
    trialDays: 0,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    priceMonthlyCents: 9900,
    cadence: "/mo",
    tagline: "Starter production tools and standard lead processing — lock your first exclusive ZIP",
    features: [
      "1 included exclusive ZIP — locks out local competitors the moment you subscribe",
      "Branded borrower experience",
      "AI intake + follow-up",
      "Standard lead processing",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP",
    countyCapacityNote: "Additional ZIPs available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP — additional ZIPs are separate paid add-ons",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$199",
    priceMonthlyCents: 19900,
    cadence: "/mo",
    tagline: "Advanced agentic AI workflows with priority execution",
    features: [
      "1 included exclusive ZIP — locks out local competitors the moment you subscribe",
      "Advanced agent workflows",
      "Priority execution over Pro",
      "SMS + email nurture ladders",
      "Calendar booking + CRM mirroring",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: true,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP",
    countyCapacityNote: "Additional ZIPs available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP — higher plans buy more automation, not more included ZIPs",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "exclusive",
    name: "Exclusive",
    price: "$299",
    priceMonthlyCents: 29900,
    cadence: "/mo",
    tagline: "The full Agentic AI suite at maximum execution capacity",
    features: [
      "1 included exclusive ZIP — locks out local competitors the moment you subscribe",
      "Full Agentic AI suite",
      "Maximum automation execution capacity",
      "Priority territory add-on access",
      "White-glove onboarding",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP",
    countyCapacityNote: "Priority access to additional ZIP add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP — priority access when adding more",
    trialDays: TRIAL_DAYS,
  },
];

export const PAID_PRICING_TIERS = PRICING_TIERS.filter((tier) => tier.priceMonthlyCents > 0);

/** Tiers in ascending order of capability — index comparison powers `tierAtLeast` in entitlements.ts. */
export const PRICING_TIER_ORDER: readonly PricingTierId[] = ["free", "pro", "growth", "exclusive"];

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
    pro: process.env.STRIPE_PRICE_ID_PRO?.trim(),
    growth: process.env.STRIPE_PRICE_ID_GROWTH?.trim(),
    exclusive: process.env.STRIPE_PRICE_ID_EXCLUSIVE?.trim(),
  };
  const byProductId: Partial<Record<PricingTierId, string | undefined>> = {
    pro: process.env.STRIPE_PRODUCT_ID_PRO?.trim(),
    growth: process.env.STRIPE_PRODUCT_ID_GROWTH?.trim(),
    exclusive: process.env.STRIPE_PRODUCT_ID_EXCLUSIVE?.trim(),
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
