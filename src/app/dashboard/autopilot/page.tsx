import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { DashboardShell } from "@/components/intelligence/dashboard-shell";
import { AutopilotPanel } from "@/components/autopilot/autopilot-panel";

export const metadata: Metadata = {
  title: "Website Autopilot",
  robots: { index: false, follow: false },
};

export default async function WebsiteAutopilotPage() {
  await requireSession("/dashboard/autopilot");

  return (
    <DashboardShell
      eyebrow="Growth automation"
      title="Website Autopilot"
      description="YPNUS can improve website/profile content for you. Safe improvements can be auto-applied later when enabled. Risky or compliance-sensitive changes require approval."
    >
      <AutopilotPanel />
    </DashboardShell>
  );
}
