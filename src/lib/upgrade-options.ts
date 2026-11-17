import { checkoutUrlForTier, payNowUrlForTier, prepaid5yUrlForTier } from "@/lib/checkout";
import { getPricingTier, PREPAID_5Y, PREPAID_5Y_REFUND_WINDOW_DAYS, PREPAID_5Y_YEARS, PLAN_ENTITLEMENTS, TRIAL_DAYS } from "@/lib/pricing";
import { BUSINESS_EMAIL } from "@/lib/author";
import { PAID_DAILY_MESSAGE_LIMIT } from "@/lib/ai/chat-agent";

/**
 * What the dashboard's upgrade slide-over offers, built on the server from the live plans
 * and the live Stripe Payment Links (src/lib/checkout.ts). Prices are today's: nothing here
 * invents a plan, a price or a checkout link. The slide-over adds the ZIP code itself
 * (as Stripe's client_reference_id, which the webhook locks at the first payment).
 */
export interface UpgradeOptions {
  planName: string;
  monthlyPrice: string;
  trialDays: number;
  payNowUrl: string | null;
  trialUrl: string;
  prepaidUrl: string | null;
  prepaidPrice: string;
  prepaidYears: number;
  prepaidRefundDays: number;
  /** What the plan includes, from the same plan matrix the pricing page shows. */
  includes: string[];
  pricingHref: string;
  supportEmail: string;
}

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function upgradeOptions(): UpgradeOptions {
  // Tier id "growth" is the plan sold as Pro, $99/mo (see src/lib/pricing.ts).
  const pro = getPricingTier("growth");
  return {
    planName: pro.name,
    monthlyPrice: pro.price,
    trialDays: TRIAL_DAYS,
    payNowUrl: payNowUrlForTier("growth"),
    trialUrl: checkoutUrlForTier("growth"),
    prepaidUrl: prepaid5yUrlForTier("growth"),
    prepaidPrice: dollars(PREPAID_5Y.growth.priceCents),
    prepaidYears: PREPAID_5Y_YEARS,
    prepaidRefundDays: PREPAID_5Y_REFUND_WINDOW_DAYS,
    includes: [
      ...PLAN_ENTITLEMENTS.filter((row) => row.growth !== "—").map((row) =>
        row.growth === "✓" ? row.label : `${row.label}: ${row.growth}`,
      ),
      `Full Cerebro: ${PAID_DAILY_MESSAGE_LIMIT} messages a day and no daily action limit`,
    ],
    pricingHref: "/pricing",
    supportEmail: BUSINESS_EMAIL,
  };
}
