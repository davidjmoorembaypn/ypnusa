import type { Metadata } from "next";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { resolveEntitlement } from "@/lib/entitlements";
import { getPricingTier } from "@/lib/pricing";
import { LogoutButton } from "@/components/logout-button";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { dateStyle: "long" });
}

export default async function AccountPage() {
  const session = await requireSession("/account");
  const entitlement = resolveEntitlement(session);
  const tier = getPricingTier(entitlement.tier);
  const trialEnds = entitlement.status === "trialing" ? formatDate(entitlement.trialEndsAt) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-900">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">Account</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your account</h1>

      <dl className="mt-8 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
        <div className="flex justify-between gap-4 px-5 py-4 text-sm">
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium">{session.email}</dd>
        </div>
        <div className="flex justify-between gap-4 px-5 py-4 text-sm">
          <dt className="text-slate-500">Plan</dt>
          <dd className="font-medium">
            {tier.name} · {tier.price}
            {tier.priceMonthlyCents > 0 ? "/mo" : ""}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-5 py-4 text-sm">
          <dt className="text-slate-500">Status</dt>
          <dd className="font-medium capitalize">
            {entitlement.status === "none" ? "free" : entitlement.status.replace("_", " ")}
          </dd>
        </div>
        {trialEnds ? (
          <div className="flex justify-between gap-4 px-5 py-4 text-sm">
            <dt className="text-slate-500">Trial ends</dt>
            <dd className="font-medium">{trialEnds}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
        <Link href="/billing" className="rounded-full bg-violet-700 px-5 py-3 text-white transition hover:bg-violet-800">
          Manage billing
        </Link>
        <Link
          href="/dashboard"
          className="rounded-full border border-violet-200 px-5 py-3 text-violet-700 transition hover:bg-violet-50"
        >
          Back to dashboard
        </Link>
        <LogoutButton className="rounded-full border border-slate-300 px-5 py-3 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60" />
      </div>
    </main>
  );
}
