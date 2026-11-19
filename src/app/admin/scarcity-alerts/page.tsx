import Link from "next/link";
import type { Metadata } from "next";
import { ScarcityDashboard } from "@/components/admin/scarcity-dashboard";
import { SessionBar } from "@/components/session-bar";
import { requireAdminSession } from "@/lib/auth";
import { listZipScarcityEvents } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scarcity alerts",
  robots: { index: false, follow: false },
};

export default async function AdminScarcityAlertsPage() {
  await requireAdminSession("/admin/scarcity-alerts");
  const events = listZipScarcityEvents(20);

  return (
    <main className="min-h-full bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href="/admin/revenue" className="font-semibold text-cyan-700 hover:text-teal-600">
            Back to revenue
          </Link>
          <SessionBar />
        </nav>
        <header>
          <h1 className="text-3xl font-semibold">Scarcity alerts</h1>
          <p className="mt-2 text-slate-600">Outreach for open ZIP codes near a ZIP code that just locked.</p>
        </header>
        <ScarcityDashboard initialEvents={events} />
        <p className="text-xs text-slate-500">
          ZIP code names and locations: GeoNames (geonames.org), CC BY 4.0. Distances are straight-line between ZIP code centers.
        </p>
      </div>
    </main>
  );
}
