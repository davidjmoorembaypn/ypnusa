import type Stripe from "stripe";
import { readDb, recordPaymentConversion } from "@/lib/db";
import type { PaymentConversionRecord } from "@/lib/types";

/**
 * Paid-conversion accounting. A "conversion" is a real customer whose live
 * payment Stripe confirmed (invoice.paid, amount > 0, livemode) AND whose
 * subscription this app has fulfilled (active in the revenue ledger).
 *
 * Deliberately NOT counted: test-mode events, $0 invoices (free trials, free
 * signups), invoices with no subscription, duplicate deliveries of the same
 * invoice/event, customers listed in CONVERSION_EXCLUDE_CUSTOMERS (existing
 * customers) and payments dated before CONVERSION_COUNT_FROM (ISO date).
 */

type InvoiceLike = Stripe.Invoice & {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
};

function idOf(value: string | { id: string } | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

export function recordInvoicePaid(event: Stripe.Event): { recorded: boolean; reason?: string } {
  if (event.type !== "invoice.paid") return { recorded: false, reason: "Not an invoice.paid event." };
  if (!event.livemode) return { recorded: false, reason: "Test-mode payment ignored." };

  const invoice = event.data.object as InvoiceLike;
  const customerId = idOf(invoice.customer as string | { id: string } | null);
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription) ?? idOf(invoice.subscription);
  const amount = typeof invoice.amount_paid === "number" ? invoice.amount_paid : 0;

  if (invoice.status !== "paid") return { recorded: false, reason: "Invoice is not paid." };
  if (amount <= 0) return { recorded: false, reason: "$0 invoice (trial or free) is not a payment." };
  if (!customerId || !subscriptionId || !invoice.id) {
    return { recorded: false, reason: "Invoice has no customer/subscription (not a subscription payment)." };
  }

  const record: PaymentConversionRecord = {
    id: invoice.id,
    eventId: event.id,
    recordedAt: new Date().toISOString(),
    paidAt: new Date((invoice.status_transitions?.paid_at ?? event.created) * 1000).toISOString(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    amountPaidCents: amount,
    currency: invoice.currency,
    billingReason: invoice.billing_reason ?? undefined,
  };
  return recordPaymentConversion(record);
}

export interface ConversionSummary {
  /** Distinct customers with at least one confirmed live payment. */
  paidCustomers: number;
  /** Of those, customers whose subscription is active in this app's ledger. */
  fulfilledCustomers: number;
  /** Qualifying conversions: paid AND fulfilled. This is the number that counts. */
  qualifyingConversions: number;
  paidButNotFulfilled: string[];
  /** Masked Stripe customer ids of qualifying conversions, earliest first. */
  qualifying: Array<{ customer: string; firstPaidAt: string; amountCents: number; tier?: string }>;
  excluded: { beforeCountFrom: number; excludedCustomers: number };
  goal: number;
}

function mask(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function summarizeConversions(
  env: { countFrom?: string; excludeCustomers?: string; goal?: number } = {
    countFrom: process.env.CONVERSION_COUNT_FROM,
    excludeCustomers: process.env.CONVERSION_EXCLUDE_CUSTOMERS,
  },
): ConversionSummary {
  const db = readDb();
  const countFrom = env.countFrom ? new Date(env.countFrom).getTime() : 0;
  const excluded = new Set(
    (env.excludeCustomers ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  let beforeCountFrom = 0;
  let excludedCustomers = 0;
  const firstByCustomer = new Map<string, PaymentConversionRecord>();
  for (const payment of [...db.paymentConversions].sort((a, b) => a.paidAt.localeCompare(b.paidAt))) {
    if (excluded.has(payment.stripeCustomerId)) {
      excludedCustomers += 1;
      continue;
    }
    if (countFrom && new Date(payment.paidAt).getTime() < countFrom) {
      beforeCountFrom += 1;
      continue;
    }
    if (!firstByCustomer.has(payment.stripeCustomerId)) firstByCustomer.set(payment.stripeCustomerId, payment);
  }

  const qualifying: ConversionSummary["qualifying"] = [];
  const paidButNotFulfilled: string[] = [];
  for (const [customer, payment] of firstByCustomer) {
    const subscription = db.revenueSubscriptions.find(
      (item) => item.stripeSubscriptionId === payment.stripeSubscriptionId && item.status === "active",
    );
    if (subscription) {
      qualifying.push({ customer: mask(customer), firstPaidAt: payment.paidAt, amountCents: payment.amountPaidCents, tier: subscription.tier });
    } else {
      paidButNotFulfilled.push(mask(customer));
    }
  }

  return {
    paidCustomers: firstByCustomer.size,
    fulfilledCustomers: qualifying.length,
    qualifyingConversions: qualifying.length,
    paidButNotFulfilled,
    qualifying,
    excluded: { beforeCountFrom, excludedCustomers },
    goal: env.goal ?? 3,
  };
}
