import type { AnalyticsEventRecord, DemoRequestRecord, PaymentConversionRecord, RevenueSubscriptionRecord } from "@/lib/types";
import type { ConversionSummary } from "@/lib/conversions";

/**
 * Owner-facing results funnel: territory requests -> trials -> active paid plans -> verified payments.
 * Built only from records this app holds. Seed/demo subscriptions are excluded, and the final stage is the
 * verified-conversion count from src/lib/conversions.ts (live, paid, fulfilled), never an estimate.
 * Website visits live in GA4, not here, so the funnel deliberately starts at the first action we can see.
 */

export interface ResultsFunnelInput {
  analyticsEvents: Pick<AnalyticsEventRecord, "type" | "createdAt">[];
  demoRequests: Pick<DemoRequestRecord, "createdAt">[];
  revenueSubscriptions: Pick<RevenueSubscriptionRecord, "status" | "source" | "startedAt">[];
  paymentConversions: Pick<PaymentConversionRecord, "paidAt">[];
  conversions: Pick<ConversionSummary, "qualifyingConversions" | "paidButNotFulfilled" | "goal">;
  now?: Date;
}

export interface FunnelStage {
  id: "cta_clicks" | "requests" | "trials" | "active" | "verified";
  label: string;
  total: number;
  last7Days: number;
  /** Share of the previous stage's total, or null for the first stage / an empty previous stage. */
  conversionFromPrevious: number | null;
}

export interface ResultsFunnel {
  stages: FunnelStage[];
  verified: number;
  goal: number;
  remainingToGoal: number;
  paidButNotFulfilled: number;
  /** Plain-English note that explains the biggest drop-off or the next blocker; never invented numbers. */
  headline: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function withinDays(iso: string, days: number, now: Date): boolean {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && now.getTime() - time <= days * DAY_MS && time <= now.getTime();
}

export function buildResultsFunnel(input: ResultsFunnelInput): ResultsFunnel {
  const now = input.now ?? new Date();
  const real = input.revenueSubscriptions.filter((item) => item.source !== "seed");

  const ctaClicks = input.analyticsEvents.filter((event) => event.type === "funnel_cta_clicked");
  const trials = real.filter((item) => item.status === "trialing");
  const active = real.filter((item) => item.status === "active");

  const raw: Array<Omit<FunnelStage, "conversionFromPrevious">> = [
    { id: "cta_clicks", label: "Clicked a call to action", total: ctaClicks.length, last7Days: ctaClicks.filter((e) => withinDays(e.createdAt, 7, now)).length },
    { id: "requests", label: "Requested a territory", total: input.demoRequests.length, last7Days: input.demoRequests.filter((r) => withinDays(r.createdAt, 7, now)).length },
    { id: "trials", label: "Started a trial", total: trials.length, last7Days: trials.filter((s) => withinDays(s.startedAt, 7, now)).length },
    { id: "active", label: "Active paid plan", total: active.length, last7Days: active.filter((s) => withinDays(s.startedAt, 7, now)).length },
    {
      id: "verified",
      label: "Verified payment",
      total: input.conversions.qualifyingConversions,
      last7Days: input.paymentConversions.filter((p) => withinDays(p.paidAt, 7, now)).length,
    },
  ];

  const stages: FunnelStage[] = raw.map((stage, index) => {
    const previous = index === 0 ? null : raw[index - 1].total;
    return { ...stage, conversionFromPrevious: previous && previous > 0 ? stage.total / previous : null };
  });

  const verified = input.conversions.qualifyingConversions;
  const goal = input.conversions.goal;
  const remainingToGoal = Math.max(goal - verified, 0);
  const paidButNotFulfilled = input.conversions.paidButNotFulfilled.length;

  return { stages, verified, goal, remainingToGoal, paidButNotFulfilled, headline: buildHeadline({ stages, verified, goal, remainingToGoal, paidButNotFulfilled }) };
}

function buildHeadline(f: Pick<ResultsFunnel, "stages" | "verified" | "goal" | "remainingToGoal" | "paidButNotFulfilled">): string {
  if (f.remainingToGoal === 0) return `Goal reached: ${f.verified} verified payment${f.verified === 1 ? "" : "s"}. Confirm each in Stripe before reporting it.`;
  if (f.paidButNotFulfilled > 0) {
    return `${f.paidButNotFulfilled} payment${f.paidButNotFulfilled === 1 ? " is" : "s are"} confirmed by Stripe but not yet active in the app. Fix fulfillment first.`;
  }
  const byId = Object.fromEntries(f.stages.map((stage) => [stage.id, stage]));
  if (byId.requests.total === 0) return "No territory requests yet. The next step is getting people to the request form.";
  if (byId.trials.total === 0) return "People are requesting territories but nobody has started a trial. Follow up on the open requests.";
  if (byId.active.total === 0) return "Trials have started and none has converted to paid yet. Trials need a card, so the first charge comes when the trial ends.";
  return `${f.remainingToGoal} more verified payment${f.remainingToGoal === 1 ? "" : "s"} needed to reach ${f.goal}.`;
}
