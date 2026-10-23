import { resolveEntitlement, isPaidEntitlement } from "@/lib/entitlements";
import { readDb } from "@/lib/db";
import { buildNurtureDashboard } from "@/lib/nurture-dashboard";
import type { SessionPayload } from "@/lib/session";

/**
 * Weekly "what should I do" plan for a loan officer, derived only from their
 * own real activity (leads, follow-ups, territory). Deterministic and
 * explainable: every action states the fact it is based on. Never invents
 * numbers, and never takes an action itself.
 */

export interface GrowthPlanInput {
  leadsLast7Days: number;
  leadsPrevious7Days: number;
  leadsEver: number;
  awaitingBooking: number;
  failedOutreach: number;
  paidPlan: boolean;
  claimedZips: number;
}

export interface PlanAction {
  id: string;
  title: string;
  /** The real fact this recommendation is based on. */
  why: string;
  href: string;
  cta: string;
  priority: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildWeeklyPlan(input: GrowthPlanInput): PlanAction[] {
  const actions: PlanAction[] = [];

  if (input.failedOutreach > 0) {
    actions.push({
      id: "fix_failed_outreach",
      title: `Fix ${input.failedOutreach} failed follow-up${input.failedOutreach === 1 ? "" : "s"}`,
      why: "Borrowers who were meant to hear from you did not receive a message. This is the fastest lost-lead risk.",
      href: "/portal/nurture",
      cta: "Open lead nurture",
      priority: 100,
    });
  }

  if (input.awaitingBooking > 0) {
    actions.push({
      id: "reach_unbooked_leads",
      title: `Reach the ${input.awaitingBooking} qualified borrower${input.awaitingBooking === 1 ? "" : "s"} who have not booked`,
      why: "They finished intake but have no appointment yet. A personal call or message is the next step.",
      href: "/portal/nurture",
      cta: "See who is waiting",
      priority: 90,
    });
  }

  if (input.paidPlan && input.claimedZips === 0) {
    actions.push({
      id: "claim_zip",
      title: "Choose your exclusive zip code",
      why: "Your plan includes a zip code, but none is claimed yet, so no territory is routing borrowers to you.",
      href: "/dashboard/territories",
      cta: "Check zip codes",
      priority: 80,
    });
  } else if (!input.paidPlan) {
    actions.push({
      id: "check_zip",
      title: "Check whether your zip code is still open",
      why: "Checking is free. A zip code is locked only when a paid plan starts.",
      href: "/pricing",
      cta: "See plans",
      priority: 40,
    });
  }

  if (input.leadsEver === 0) {
    actions.push({
      id: "share_borrower_link",
      title: "Share your borrower link this week",
      why: "No borrower has used your intake yet. One post or one message to a Realtor is the first step.",
      href: "/tools/social-writer",
      cta: "Draft a post",
      priority: 70,
    });
  } else if (input.leadsLast7Days === 0) {
    actions.push({
      id: "post_this_week",
      title: "Publish one educational post this week",
      why: `You had ${input.leadsPrevious7Days} new borrower${input.leadsPrevious7Days === 1 ? "" : "s"} the week before and none in the last 7 days.`,
      href: "/tools/social-writer",
      cta: "Draft a post",
      priority: 60,
    });
  } else if (input.leadsLast7Days < input.leadsPrevious7Days) {
    actions.push({
      id: "reverse_dip",
      title: "New borrowers dipped this week. Post and ask for referrals",
      why: `${input.leadsLast7Days} new this week versus ${input.leadsPrevious7Days} the week before.`,
      href: "/tools/social-writer",
      cta: "Draft a post",
      priority: 55,
    });
  }

  actions.push({
    id: "refresh_gbp",
    title: "Refresh your Google Business Profile",
    why: "A current profile helps local borrowers find and trust you. Update it once a month.",
    href: "/tools/gbp-optimizer",
    cta: "Optimize profile",
    priority: 30,
  });

  return actions.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/** Reads this officer's real numbers. Admins see the whole book. */
export function loadGrowthPlanInput(
  session: Pick<SessionPayload, "sub" | "role" | "tier" | "subscriptionStatus">,
  now: number = Date.now(),
): GrowthPlanInput {
  const db = readDb();
  const loId = session.role === "admin" ? undefined : session.sub;
  const leads = db.borrowerLeads.filter((lead) => loId === undefined || lead.assignedLoId === loId);
  const stamp = (iso: string) => Date.parse(iso);

  const leadsLast7Days = leads.filter((lead) => now - stamp(lead.createdAt) <= 7 * DAY_MS).length;
  const leadsPrevious7Days = leads.filter((lead) => {
    const age = now - stamp(lead.createdAt);
    return age > 7 * DAY_MS && age <= 14 * DAY_MS;
  }).length;

  const dashboard = buildNurtureDashboard(loId);
  const awaitingBooking = dashboard.rows.filter((row) => row.state === "Awaiting booking").length;
  const failedOutreach = dashboard.rows.filter((row) => row.state === "Outreach failed").length;

  const claimedZips = db.revenueSubscriptions
    .filter(
      (subscription) =>
        // Seeded demo records are not anyone's real territory.
        subscription.source !== "seed" &&
        (loId === undefined || subscription.ownerLoId === loId) &&
        (subscription.status === "active" || subscription.status === "trialing"),
    )
    .reduce((total, subscription) => total + subscription.claimedZips.length, 0);

  return {
    leadsLast7Days,
    leadsPrevious7Days,
    leadsEver: leads.length,
    awaitingBooking,
    failedOutreach,
    paidPlan: isPaidEntitlement(resolveEntitlement(session as SessionPayload)),
    claimedZips,
  };
}
