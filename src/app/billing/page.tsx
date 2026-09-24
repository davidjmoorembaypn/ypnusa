import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { resolveEntitlement } from "@/lib/entitlements";
import { PUBLIC_PRICING_TIERS, TRIAL_DAYS } from "@/lib/pricing";
import { marketingUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Stripe-hosted Customer Portal login link (set STRIPE_CUSTOMER_PORTAL_URL); upgrade/downgrade/cancel all happen there. */
function portalUrl(): string | null {
  return process.env.STRIPE_CUSTOMER_PORTAL_URL?.trim() || null;
}

export default async function BillingPage() {
  const session = await requireSession("/billing");
  const entitlement = resolveEntitlement(session);
  const portal = portalUrl();
  const isPaid = entitlement.tier !== "free";

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">Billing</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Plan and billing</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Paid plans include a {TRIAL_DAYS}-day free trial and renew monthly until cancelled. You can change or cancel
        online at any time from the billing portal.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {PUBLIC_PRICING_TIERS.map((tier) => {
          const current = tier.id === entitlement.tier;
          return (
            <li
              key={tier.id}
              className={`rounded-2xl border p-5 ${current ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"}`}
            >
              <p className="text-sm font-semibold">
                {tier.name}
                {current ? (
                  <span className="ml-2 rounded-full bg-violet-700 px-2 py-0.5 text-[11px] text-white">Current</span>
                ) : null}
              </p>
              <p className="mt-1 text-2xl font-semibold">
                {tier.price}
                {tier.priceMonthlyCents > 0 ? <span className="text-sm font-normal text-slate-500">/mo</span> : null}
              </p>
              <p className="mt-2 text-[13px] text-slate-600">{tier.zipCapacityLabel}</p>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
        {portal && isPaid ? (
          <a href={portal} className="rounded-full bg-violet-700 px-5 py-3 text-white transition hover:bg-violet-800">
            Open billing portal
          </a>
        ) : (
          <a
            href={marketingUrl("/pricing.html")}
            className="rounded-full bg-violet-700 px-5 py-3 text-white transition hover:bg-violet-800"
          >
            {isPaid ? "View plans" : `Start ${TRIAL_DAYS}-day trial`}
          </a>
        )}
        <Link
          href="/account"
          className="rounded-full border border-violet-200 px-5 py-3 text-violet-700 transition hover:bg-violet-50"
        >
          Account
        </Link>
      </div>
    </main>
  );
}
