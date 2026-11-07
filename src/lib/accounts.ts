import { readDb, writeDb } from "@/lib/db";
import { generateId } from "@/lib/id";
import { PRICING_TIER_ORDER, type PricingTierId } from "@/lib/pricing";
import type { EntitlementStatus } from "@/lib/session";
import type { AccountRecord, RevenueSubscriptionRecord } from "@/lib/types";

/**
 * Native accounts for ypnus.com / app.ypnus.com. Replaces WordPress as the identity source:
 * people sign in with an emailed one-time link (src/lib/email-login.ts), so no passwords are
 * stored or migrated. Paid access comes from the Stripe-fed subscription ledger, matched by
 * the email the customer used at checkout.
 */

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 320) return null;
  // Deliberately simple: one @, something on each side, a dot in the domain, no spaces.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Emails listed in ADMIN_EMAILS (comma-separated) sign in with the admin role. */
export function roleForEmail(email: string): AccountRecord["role"] {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email) ? "admin" : "mlo";
}

export function findAccountByEmail(email: string): AccountRecord | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return readDb().accounts.find((account) => account.email === normalized) ?? null;
}

/**
 * Creates the account on first sign-in (or first checkout), otherwise updates it.
 * Returns the stored record.
 */
export function upsertAccount(input: {
  email: string;
  source: AccountRecord["source"];
  name?: string;
  markLogin?: boolean;
}): AccountRecord {
  const email = normalizeEmail(input.email);
  if (!email) throw new Error("upsertAccount needs a valid email.");
  const now = new Date().toISOString();
  const db = writeDb((db) => {
    const existing = db.accounts.find((account) => account.email === email);
    if (existing) {
      existing.role = roleForEmail(email);
      if (input.name && !existing.name) existing.name = input.name;
      if (input.markLogin) existing.lastLoginAt = now;
      return;
    }
    const created: AccountRecord = {
      id: generateId("acct"),
      email,
      role: roleForEmail(email),
      createdAt: now,
      source: input.source,
      ...(input.name ? { name: input.name } : {}),
      ...(input.markLogin ? { lastLoginAt: now } : {}),
    };
    db.accounts.push(created);
  });
  const stored = db.accounts.find((account) => account.email === email);
  if (!stored) throw new Error("Account was not saved.");
  return structuredClone(stored);
}

/** Only real billing sources grant access; seeded demo rows and demo-request inferences never do. */
const ENTITLING_SOURCES = new Set<RevenueSubscriptionRecord["source"]>([
  "stripe_webhook",
  "admin_adjustment",
]);

export interface AccountEntitlement {
  tier: PricingTierId;
  subscriptionStatus: EntitlementStatus;
}

/**
 * The best current plan for an email, read from the subscription ledger that the Stripe
 * webhook keeps up to date. Free with status "none" when there is no live subscription.
 */
export function entitlementForEmail(email: string): AccountEntitlement {
  const normalized = normalizeEmail(email);
  if (!normalized) return { tier: "free", subscriptionStatus: "none" };
  const live = readDb().revenueSubscriptions.filter(
    (subscription) =>
      ENTITLING_SOURCES.has(subscription.source) &&
      subscription.status !== "cancelled" &&
      normalizeEmail(subscription.ownerEmail) === normalized,
  );
  if (live.length === 0) return { tier: "free", subscriptionStatus: "none" };
  const best = live.reduce((top, candidate) =>
    PRICING_TIER_ORDER.indexOf(candidate.tier) > PRICING_TIER_ORDER.indexOf(top.tier) ? candidate : top,
  );
  return { tier: best.tier, subscriptionStatus: best.status === "trialing" ? "trialing" : "active" };
}

/** True when the ledger holds any Stripe/admin subscription record (live or cancelled) for this email. */
export function hasLedgerRecordForEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return readDb().revenueSubscriptions.some(
    (subscription) =>
      ENTITLING_SOURCES.has(subscription.source) && normalizeEmail(subscription.ownerEmail) === normalized,
  );
}

/** ZIPs locked by this email's live (active/trialing) subscriptions, oldest first. */
export function claimedZipsForEmail(email: string): string[] {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const zips = readDb()
    .revenueSubscriptions.filter(
      (subscription) =>
        ENTITLING_SOURCES.has(subscription.source) &&
        subscription.status !== "cancelled" &&
        normalizeEmail(subscription.ownerEmail) === normalized,
    )
    .flatMap((subscription) => subscription.claimedZips);
  return [...new Set(zips)];
}
