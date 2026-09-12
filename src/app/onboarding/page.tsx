import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { readAgentOnboarding } from "@/lib/db";
import { resolveEntitlement, automationDailyLimitFor } from "@/lib/entitlements";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Activate Cerebro", robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const session = await requireSession("/onboarding");
  const entitlement = resolveEntitlement(session);
  return (
    <OnboardingWizard
      email={session.email}
      initialProfile={readAgentOnboarding(session.sub)}
      tier={entitlement.tier}
      dailyLimit={automationDailyLimitFor(entitlement)}
    />
  );
}
