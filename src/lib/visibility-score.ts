import { claimedZipsForEmail } from "@/lib/accounts";
import { readDb } from "@/lib/db";
import { isOfficerProfileComplete, publicOfficerPageFor } from "@/lib/officer-profile";

/**
 * Local Visibility Score: a setup checklist for a loan officer, computed only from
 * data the app really has. Steps the app can't do yet are listed as "coming soon"
 * and are left out of the percentage, so the score never rewards something fake.
 */
export interface VisibilityStep {
  id: string;
  label: string;
  done: boolean;
  /** What Cerebro is asked when the loan officer taps "Do it with Cerebro". */
  cerebroPrompt?: string;
  /** Link for steps finished outside the chat (e.g. pricing to lock a ZIP code). */
  href?: string;
  hrefLabel?: string;
  comingSoon?: boolean;
}

export interface VisibilityScore {
  percent: number;
  doneCount: number;
  totalCount: number;
  steps: VisibilityStep[];
}

const PROMPTS = {
  plan: "Give me a step-by-step plan to get visible in my ZIP code this month.",
  gbpDraft:
    "Draft my Google Business Profile for a mortgage loan officer: business name rules, primary and secondary categories, description, services, service areas by ZIP code, and NMLS disclosure text. Ask me for anything you need.",
  gbpPost: "Write my first Google Business Profile post for my ZIP code, with a compliant call to action.",
  reviews: "Write a short, compliant text and email asking past clients for a Google review.",
} as const;

export function computeVisibilityScore(input: { userId: string; email: string }): VisibilityScore {
  const db = readDb();
  const onboarding = db.agentOnboarding.find((record) => record.userId === input.userId);
  const lockedZips = claimedZipsForEmail(input.email);
  const mySessions = db.chatSessions.filter(
    (session) => session.mode === "mlo_dashboard" && session.userId === input.userId,
  );
  const usedCerebro = mySessions.length > 0;
  // A Cerebro step counts as done once the loan officer has asked Cerebro for it.
  const asked = (prompt: string) =>
    mySessions.some((session) => session.messages.some((message) => message.role === "user" && message.content.trim() === prompt));
  const leads = db.crmLeads.filter((lead) => lead.assignedLoId === input.userId).length;
  const borrowerPage = publicOfficerPageFor(onboarding);

  const steps: VisibilityStep[] = [
    {
      id: "zip",
      label: lockedZips.length ? `ZIP code ${lockedZips[0]} locked to you` : "Lock your exclusive ZIP code (paid plan)",
      done: lockedZips.length > 0,
      href: "/pricing",
      hrefLabel: "Lock my ZIP code",
    },
    {
      id: "profile",
      label: "Complete your profile: name, NMLS ID, phone and headshot",
      done: isOfficerProfileComplete(onboarding),
      href: "/onboarding?step=profile",
      hrefLabel: "Complete my profile",
    },
    {
      id: "onboarding",
      label: "Set your goal and guardrails in Activate Cerebro",
      done: (onboarding?.completedStep ?? 0) >= 5 || onboarding?.status === "active",
      href: "/onboarding",
      hrefLabel: "Finish setup",
    },
    {
      id: "cerebro",
      label: "Ask Cerebro for your local visibility plan",
      done: usedCerebro,
      cerebroPrompt: PROMPTS.plan,
    },
    {
      id: "gbp-draft",
      label: "Draft your Google Business Profile (categories, description, services, service area)",
      done: asked(PROMPTS.gbpDraft),
      cerebroPrompt: PROMPTS.gbpDraft,
    },
    {
      id: "gbp-post",
      label: "Write your first Google Business Profile post",
      done: asked(PROMPTS.gbpPost),
      cerebroPrompt: PROMPTS.gbpPost,
    },
    {
      id: "reviews",
      label: "Ask past clients for Google reviews",
      done: asked(PROMPTS.reviews),
      cerebroPrompt: PROMPTS.reviews,
    },
    {
      id: "first-lead",
      label: "Receive your first borrower lead",
      done: leads > 0,
    },
    {
      id: "borrower-page",
      label: borrowerPage
        ? "Your borrower page is live"
        : "Publish your borrower page (needs your profile and a locked ZIP code)",
      done: borrowerPage !== null,
      href: lockedZips.length ? "/onboarding?step=profile" : "/pricing",
      hrefLabel: lockedZips.length ? "Set up my page" : "Lock my ZIP code",
    },
    { id: "zip-pages", label: "Local ZIP code pages published for your territory", done: false, comingSoon: true },
    { id: "gbp-connect", label: "Connect Google Business Profile so Cerebro can post for you", done: false, comingSoon: true },
  ];

  const scored = steps.filter((step) => !step.comingSoon);
  const doneCount = scored.filter((step) => step.done).length;
  return {
    percent: scored.length ? Math.round((doneCount / scored.length) * 100) : 0,
    doneCount,
    totalCount: scored.length,
    steps,
  };
}
