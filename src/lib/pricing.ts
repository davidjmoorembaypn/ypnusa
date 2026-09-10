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
      "You own every lead you capture",
      "Upgrade when pull-through is real",
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
    id: "starter",
    name: "Starter",
    price: "$29.99",
    priceMonthlyCents: 2999,
    cadence: "/mo",
    tagline: "Lock your first exclusive ZIP",
    features: [
      "1 included exclusive ZIP",
      "Branded borrower experience",
      "AI intake + follow-up",
      "Territory demand reports",
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
    price: "$99",
    priceMonthlyCents: 9900,
    cadence: "/mo",
    tagline: "More automation, same exclusive footprint",
    features: [
      "1 included exclusive ZIP",
      "Higher automation run limits",
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
    id: "pro",
    name: "Pro",
    price: "$199",
    priceMonthlyCents: 19900,
    cadence: "/mo",
    tagline: "For the serious loan officer",
    features: [
      "1 included exclusive ZIP",
      "Portable MLO website",
      "Priority lead delivery",
      "Advanced life-event signals",
      "15-day free trial",
    ],
    cta: "Start 15-day trial",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 included ZIP",
    countyCapacityNote: "Additional ZIPs available as paid add-ons, subject to availability",
    capacityNote: "1 included exclusive ZIP — higher plans buy more capability, not more included ZIPs",
    trialDays: TRIAL_DAYS,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$299",
    priceMonthlyCents: 29900,
    cadence: "/mo",
    tagline: "Maximum automation and priority support",
    features: [
      "1 included exclusive ZIP",
      "Priority territory add-on access",
      "Unlimited automation runs",
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
