import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { AreaDataCard } from "@/components/intelligence/area-data-card";
import { LifeEventPanel } from "@/components/intelligence/life-event-panel";

export const metadata: Metadata = {
  title: "Life-Event Intelligence",
  robots: { index: false, follow: false },
};

export default async function LifeEventsDashboardPage({ searchParams }: { searchParams: Promise<{ zip?: string | string[] }> }) {
  await requireSession("/dashboard/life-events");
  const { zip } = await searchParams;
  const zipValue = (Array.isArray(zip) ? zip[0] : zip)?.trim();

  return (
    <DashboardShell
      eyebrow="Platform brain"
      title="Life-event intelligence"
      description="Public area statistics for a ZIP code (county births, deaths and migration; state marriage and divorce rates), and a rule-based score built from them."
    >
      <AreaDataCard zip={zipValue} />
      <LifeEventPanel />
    </DashboardShell>
  );
}
