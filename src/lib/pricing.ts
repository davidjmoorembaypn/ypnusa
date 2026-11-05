/**
 * Current plan lineup (Nov 2026): Free $0, Pro $99, Growth $199, Exclusive $299.
 * Every paid plan includes one exclusive ZIP territory; higher plans add capability.
 *
 * The previous lineup used some of the same words for different price points
 * (Growth was $99.99, Pro was $199.99, Elite was $299.99, Starter was $29.99).
 * Anything that arrives in that older vocabulary (WordPress SSO claims, Stripe
 * prices tagged with `metadata.ypnus_tier`, records stored before this change)
 * goes through `fromLegacyTierName` / `parseStoredTier` below, never straight
 * through `isPricingTierId`.
 */
export type PricingTierId = "free" | "pro" | "growth" | "exclusive";

/** Tier names from the retired lineup, as WordPress and older Stripe prices send them. */
export type LegacyTierName = "starter" | "growth" | "pro" | "elite";

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
    tagline: "Meet Cerebro and check your ZIP before you pay anything",
    features: [
      "Cerebro AI growth plan for your market",
      "Try Cerebro's borrower chat on a demo page",
      "ZIP availability checks",
      "No protected ZIP and no live lead delivery",
    ],
    cta: "Start free",
    highlight: false,
    zipCapacity: 0,
    zipCapacityLabel: "No protected ZIP",
    countyCapacityNote: "No territory",
    capacityNote: "Cerebro preview only. A protected ZIP and live lead delivery start on a paid plan.",
    trialDays: 0,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    priceMonthlyCents: 9900,
    cadence: "/mo",
    tagline: "Core production tools for a working loan officer",
    features: [
      "1 protected ZIP territory",
      "Cerebro answers and qualifies borrowers 24/7",
      "Branded borrower intake on your own site",
      "Lead delivery to you with email follow-up",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 protected ZIP",
    countyCapacityNote: "Additional ZIPs available as paid add-ons, subject to availability",
    capacityNote: "1 protected ZIP. Additional ZIPs are separate paid add-ons.",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$199",
    priceMonthlyCents: 19900,
    cadence: "/mo",
    tagline: "Advanced tools to scale your production",
    features: [
      "Everything in Pro",
      "Cerebro workflow assistant for your pipeline",
      "SMS and email nurture sequences",
      "Calendar booking and CRM sync",
      "Local SEO pages and Realtor co-marketing",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: true,
    zipCapacity: 1,
    zipCapacityLabel: "1 protected ZIP",
    countyCapacityNote: "Additional ZIPs available as paid add-ons, subject to availability",
    capacityNote: "1 protected ZIP. Higher plans add capability, not more included ZIPs.",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "exclusive",
    name: "Exclusive",
    price: "$299",
    priceMonthlyCents: 29900,
    cadence: "/mo",
    tagline: "The full suite, built to lock down your market",
    features: [
      "Everything in Growth",
      "First access to neighboring ZIP add-ons",
      "Unlimited Cerebro automation",
      "Google Business Profile and website autopilot",
      "White-glove onboarding",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 protected ZIP + first access to add-ons",
    countyCapacityNote: "Priority access to additional ZIP add-ons, subject to availability",
    capacityNote: "1 protected ZIP, with first access when neighboring ZIPs open up.",
    trialDays: TRIAL_DAYS,
  },
];

export const PAID_PRICING_TIERS = PRICING_TIERS.filter((tier) => tier.priceMonthlyCents > 0);

/** Every current tier is offered publicly. */
export const PUBLIC_PRICING_TIERS = PRICING_TIERS;

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
 * Maps a tier name from the retired lineup to the current tier at the same price point:
 * Starter ($29.99) and Growth ($99.99) -> Pro ($99), Pro ($199.99) -> Growth ($199),
 * Elite ($299.99) -> Exclusive ($299). Use this for anything that still speaks the old
 * vocabulary: WordPress SSO claims and Stripe prices tagged with `metadata.ypnus_tier`.
 */
export function fromLegacyTierName(value: unknown): PricingTierId | null {
  switch (typeof value === "string" ? value.trim().toLowerCase() : "") {
    case "starter":
    case "growth":
      return "pro";
    case "pro":
      return "growth";
    case "elite":
      return "exclusive";
    case "free":
      return "free";
    default:
      return null;
  }
}

/**
 * Reads a tier saved before or after the Nov 2026 lineup change. "starter" and "elite" only
 * exist in the old lineup. "growth" and "pro" exist in both, so a stored legacy monthly price
 * (9999 or 19999 cents) decides which lineup the record came from; without one, the record is
 * read as the current lineup.
 */
export function parseStoredTier(value: unknown, monthlyPriceCents?: number): PricingTierId | null {
  if (value === "starter" || value === "elite") return fromLegacyTierName(value);
  if ((value === "growth" || value === "pro") && (monthlyPriceCents === 9999 || monthlyPriceCents === 19999)) {
    return monthlyPriceCents === 9999 ? "pro" : "growth";
  }
  return isPricingTierId(value) ? value : null;
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
