import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * True while a subscription grants plan access and holds its ZIP code locks: not
 * cancelled (cancel and refund both cancel) and, for prepaid terms such as the
 * 5-year plan, not past its expiresAt date.
 */
export function isLiveSubscription(subscription: RevenueSubscriptionRecord, now: number = Date.now()): boolean {
  if (subscription.status === "cancelled") return false;
  if (subscription.expiresAt && Date.parse(subscription.expiresAt) <= now) return false;
  return true;
}
