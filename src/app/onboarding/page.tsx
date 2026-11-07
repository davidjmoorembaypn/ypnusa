import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { readAgentOnboarding } from "@/lib/db";
import { resolveEntitlement, automationDailyLimitFor } from "@/lib/entitlements";
import { claimedZipsForEmail } from "@/lib/accounts";
import { officerPagePath, officerPhotoUrl, publicOfficerPageFor } from "@/lib/officer-profile";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Activate Cerebro", robots: { index: false, follow: false } };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession("/onboarding");
  const entitlement = resolveEntitlement(session);
  const { step } = await searchParams;
  const profile = readAgentOnboarding(session.sub);
  const borrowerPage = publicOfficerPageFor(profile);
  return (
    <OnboardingWizard
      email={session.email}
      initialProfile={profile}
      purchasedZip={session.email ? claimedZipsForEmail(session.email)[0] : undefined}
      tier={entitlement.tier}
      dailyLimit={automationDailyLimitFor(entitlement)}
      // ?step=profile (from the dashboard's "Complete your profile") reopens step 1.
      startAtProfile={step === "profile"}
      initialPhotoUrl={profile?.officerPhoto ? officerPhotoUrl(session.sub, profile.officerPhoto) : null}
      initialBorrowerPagePath={borrowerPage ? officerPagePath(borrowerPage.slug) : null}
    />
  );
}
