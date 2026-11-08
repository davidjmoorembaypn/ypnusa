import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * True while a subscription grants plan access and holds its ZIP code locks: not
 * cancelled (cancel and refund both cancel) and, for prepaid terms such as the
 * 5-year plan, not past its expiresAt date.
 *
 * Demo seed records (source "seed": made-up officers in Austin, Miami and Phoenix
 * that a fresh store starts with) never count in production, so they can't show a
 * real ZIP code as taken or inflate revenue. They stay live in dev and tests.
 */
export function isLiveSubscription(subscription: RevenueSubscriptionRecord, now: number = Date.now()): boolean {
  if (subscription.status === "cancelled") return false;
  if (subscription.expiresAt && Date.parse(subscription.expiresAt) <= now) return false;
  if (subscription.source === "seed" && process.env.NODE_ENV === "production") return false;
  return true;
}
