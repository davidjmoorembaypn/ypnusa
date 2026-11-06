import { normalizeEmail, upsertAccount } from "@/lib/accounts";
import { readDb, saveRevenueSubscription } from "@/lib/db";
import { isPricingTierId, type PricingTierId } from "@/lib/pricing";
import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * One-time move of accounts and ZIP territory locks from WordPress into this app.
 * Input is the JSON printed by scripts/wordpress-export-accounts.php. Nothing is written
 * until `applyWordPressImport` runs, and re-running it is safe: accounts are matched by
 * email and subscriptions by a stable id built from the Stripe subscription id.
 */

export interface WordPressExport {
  exportedAt?: string;
  users: Array<{
    wpUserId: string;
    email: string;
    name?: string;
    registeredAt?: string;
    isAdmin?: boolean;
    tier?: string;
    subscriptionStatus?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }>;
  zipLocks: Array<{ zip: string; wpUserId: string; stripeSubscriptionId?: string; tier?: string; lockedAt?: string }>;
}

export interface WordPressImportPlan {
  accounts: Array<{ email: string; wpUserId: string; name?: string }>;
  subscriptions: RevenueSubscriptionRecord[];
  /** Things a person should look at before applying: skipped users, ZIP conflicts, unknown tiers. */
  warnings: string[];
}

function statusFromWordPress(value: string | undefined): RevenueSubscriptionRecord["status"] | null {
  if (value === "active") return "active";
  if (value === "trialing") return "trialing";
  // past_due / canceled / blank hold no paid access or territory after the move.
  return null;
}

export function planWordPressImport(data: WordPressExport): WordPressImportPlan {
  const warnings: string[] = [];
  const accounts: WordPressImportPlan["accounts"] = [];
  const subscriptions: RevenueSubscriptionRecord[] = [];

  const locksByUser = new Map<string, string[]>();
  for (const lock of data.zipLocks ?? []) {
    const zip = String(lock.zip ?? "").replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) {
      warnings.push(`Skipped a ZIP lock with an invalid ZIP for WordPress user ${lock.wpUserId}.`);
      continue;
    }
    locksByUser.set(lock.wpUserId, [...(locksByUser.get(lock.wpUserId) ?? []), zip]);
  }

  const existingClaims = new Map<string, string>();
  for (const subscription of readDb().revenueSubscriptions) {
    if (subscription.source === "seed" || subscription.source === "demo_request") continue;
    if (subscription.status === "cancelled") continue;
    for (const zip of subscription.claimedZips) existingClaims.set(zip, subscription.ownerEmail ?? subscription.id);
  }

  for (const user of data.users ?? []) {
    const email = normalizeEmail(user.email);
    if (!email) {
      warnings.push(`Skipped WordPress user ${user.wpUserId}: no valid email.`);
      continue;
    }
    accounts.push({ email, wpUserId: user.wpUserId, ...(user.name ? { name: user.name } : {}) });

    const status = statusFromWordPress(user.subscriptionStatus);
    const zips = locksByUser.get(user.wpUserId) ?? [];
    if (!status) {
      if (zips.length > 0) {
        warnings.push(`${email} has ZIP lock(s) ${zips.join(", ")} but no active plan in WordPress; the ZIPs are not carried over.`);
      }
      continue;
    }
    // WordPress and the app share the same tier ids (growth = Pro $99, pro = Growth $199,
    // elite = Exclusive $299; see src/lib/pricing.ts), so the stored name carries over as is.
    const tier: PricingTierId | null = isPricingTierId(user.tier) ? user.tier : null;
    if (!tier || tier === "free") {
      warnings.push(`${email} is ${status} but has an unrecognized tier "${user.tier ?? ""}"; skipped their plan.`);
      continue;
    }
    for (const zip of zips) {
      const holder = existingClaims.get(zip);
      if (holder && holder !== email) warnings.push(`ZIP ${zip} for ${email} is already held by ${holder} in the app.`);
    }
    const stableKey = user.stripeSubscriptionId || `wp_${user.wpUserId}`;
    const now = new Date().toISOString();
    subscriptions.push({
      id: `sub_wp_${stableKey}`,
      createdAt: now,
      startedAt: user.registeredAt ? new Date(`${user.registeredAt.replace(" ", "T")}Z`).toISOString() : now,
      tier,
      status,
      source: "wordpress_import",
      ownerEmail: email,
      claimedZips: zips,
      ...(user.stripeCustomerId ? { stripeCustomerId: user.stripeCustomerId } : {}),
      ...(user.stripeSubscriptionId ? { stripeSubscriptionId: user.stripeSubscriptionId } : {}),
    });
  }

  return { accounts, subscriptions, warnings };
}

export function applyWordPressImport(plan: WordPressImportPlan): { accounts: number; subscriptions: number } {
  const existingByStripeId = new Map(
    readDb()
      .revenueSubscriptions.filter((subscription) => subscription.stripeSubscriptionId)
      .map((subscription) => [subscription.stripeSubscriptionId as string, subscription]),
  );
  for (const account of plan.accounts) {
    upsertAccount({ email: account.email, source: "wordpress_import", wpUserId: account.wpUserId, name: account.name });
  }
  let written = 0;
  for (const subscription of plan.subscriptions) {
    // If the Stripe webhook already mirrored this subscription into the app, keep that
    // record (it is newer) and only add ZIPs it doesn't have yet.
    const mirrored = subscription.stripeSubscriptionId ? existingByStripeId.get(subscription.stripeSubscriptionId) : undefined;
    if (mirrored && mirrored.id !== subscription.id) {
      const zips = Array.from(new Set([...mirrored.claimedZips, ...subscription.claimedZips]));
      saveRevenueSubscription({ ...mirrored, claimedZips: zips, ownerEmail: mirrored.ownerEmail ?? subscription.ownerEmail });
    } else {
      saveRevenueSubscription(subscription);
    }
    written += 1;
  }
  return { accounts: plan.accounts.length, subscriptions: written };
}
