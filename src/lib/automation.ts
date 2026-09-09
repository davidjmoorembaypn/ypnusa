import { appendAnalytics, persistFollowUpsBatch, readDb, writeDb } from "./db";
import { automationDailyLimitFor, resolveOfficerEntitlement } from "./entitlements";
import { generateId } from "./id";
import { deliverOutreach } from "./outreach";
import { buildZipContext } from "./agents/zipContext";
import { buildCountyEvents } from "./agents/countyEvents";
import { scoreLead, type Lead } from "./agents/predictiveAgent";
import { buildPersonalization, type PersonalizationSummary } from "./personalization/personalizationEngine";
import type {
  BorrowerAnswers,
  BorrowerLeadRecord,
  FollowUpPlan,
  ScheduledFollowUpRecord,
} from "./types";

const ROLLING_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How many follow-ups this officer has already had sent in the last rolling
 * day, across all their leads — the counter automationDailyLimitFor's cap
 * applies against. Pure read over the current snapshot; the caller re-checks
 * against a fresh snapshot per job, so this doesn't need to be exact under
 * concurrent runs, only close enough to stop a runaway automation loop.
 */
function officerSentInLastDay(db: ReturnType<typeof readDb>, officerId: string): number {
  const cutoff = Date.now() - ROLLING_DAY_MS;
  const leadIds = new Set(
    db.borrowerLeads.filter((lead) => lead.assignedLoId === officerId).map((lead) => lead.id),
  );
  return db.followUps.filter(
    (job) =>
      job.status === "sent" &&
      leadIds.has(job.borrowerLeadId) &&
      job.sentAt &&
      new Date(job.sentAt).getTime() >= cutoff,
  ).length;
}

/**
 * Best-effort ZIP-derived personalization for outreach copy — same
 * computation /api/personalize already performs. Never throws and never
 * blocks delivery: returns undefined when the lead has no ZIP (not
 * currently collected by intake) or a provider call fails.
 */
async function resolveOutreachPersonalization(
  lead: BorrowerLeadRecord,
): Promise<PersonalizationSummary | undefined> {
  const zip = lead.answers.zip;
  if (!zip) return undefined;

  try {
    const zipContext = await buildZipContext(zip);
    const countyEvents = await buildCountyEvents(zipContext.county);
    const leadForScoring: Lead = {
      id: lead.id,
      name: lead.answers.name ?? "Borrower",
      email: lead.answers.email,
      phone: lead.answers.phone,
      zip,
      tags: [lead.answers.loanProgram],
      createdAt: lead.createdAt,
    };
    const predictive = scoreLead(leadForScoring, zipContext, countyEvents);
    return buildPersonalization({ zipContext, countyEvents, predictive });
  } catch (error) {
    console.error("[automation] outreach personalization lookup failed", error);
    return undefined;
  }
}

export function demoDayMilliseconds(): number {
  if (process.env.LOANPILOT_DEMO_MODE === "1") {
    /** Two minutes substitutes for twenty-four hours in investor demos */
    return 120_000;
  }

  const minutes = Number(process.env.LOANPILOT_DEMO_DAY_MINUTES ?? "");
  if (Number.isFinite(minutes) && minutes > 0) {
    return minutes * 60_000;
  }

  return 86_400_000;
}

function offsetSinceNow(plan: FollowUpPlan): number {
  const day = demoDayMilliseconds();

  switch (plan) {
    case "immediate_confirmation_email":
    case "immediate_sms_ack":
      return 0;
    case "day_1_educational_email":
      return day;
    case "day_3_book_call_email":
      return day * 3;
    case "day_5_urgency_email":
      return day * 5;
    case "day_30_check_in":
      return day * 30;
    case "day_60_check_in":
      return day * 60;
    case "day_90_check_in":
      return day * 90;
    default:
      return plan satisfies never;
  }
}

const nurtureCopy: Record<FollowUpPlan, string> = {
  immediate_confirmation_email:
    "Thanks for trusting YPN USA—disclosures are staged and your loan officer inbox just lit up.",
  immediate_sms_ack:
    "SMS handshake fired (Twilio-compatible placeholder)—borrower can reply STOP any time.",
  day_1_educational_email:
    "Education drip: underwriting checklist + video explainer comparing term vs amortization deltas.",
  day_3_book_call_email:
    "Conversion nudge—highlight three live consultation blocks mirrored from LOS calendar placeholders.",
  day_5_urgency_email:
    "Momentum reminder—pair live pricing volatility with LOS-ready document requests.",
  day_30_check_in: "30-day borrower readiness check-in.",
  day_60_check_in: "60-day purchase or refinance timeline check-in.",
  day_90_check_in: "90-day mortgage game-plan refresh.",
};

export function scheduleBorrowerJourney(
  borrowerLeadId: string,
  answers: BorrowerAnswers,
): ScheduledFollowUpRecord[] {
  if (answers.contactConsent !== true) return [];

  const email = answers.email ?? "borrower-not-provided@loanapilot.ai";
  const phone = answers.phone ?? "+10005550199";

  const plans: FollowUpPlan[] = [
    "immediate_confirmation_email",
    "immediate_sms_ack",
    "day_1_educational_email",
    "day_3_book_call_email",
    "day_5_urgency_email",
    "day_30_check_in",
    "day_60_check_in",
    "day_90_check_in",
  ];

  const anchor = Date.now();
  const created: ScheduledFollowUpRecord[] = plans.map((plan) => ({
    id: generateId("fu"),
    borrowerLeadId,
    plan,
    channel: plan === "immediate_sms_ack" ? "sms" : "email",
    recipient: plan === "immediate_sms_ack" ? phone : email,
    scheduledAt: new Date(anchor + offsetSinceNow(plan)).toISOString(),
    status: "pending",
    bodySummary: nurtureCopy[plan],
    createdAt: new Date().toISOString(),
  }));

  persistFollowUpsBatch(created);
  return created;
}

export async function processDueFollowUps(options?: {
  borrowerLeadId?: string;
  limit?: number;
}): Promise<{
  processed: number;
  failed: number;
  events: string[];
}> {
  let processed = 0;
  let failed = 0;
  const events: string[] = [];
  const claimedIds: string[] = [];
  const limit = Math.max(1, Math.min(options?.limit ?? 50, 100));

  writeDb((db) => {
    const now = Date.now();
    for (const job of db.followUps) {
      if (claimedIds.length >= limit) break;
      if (job.status !== "pending") continue;
      if (options?.borrowerLeadId && job.borrowerLeadId !== options.borrowerLeadId) continue;
      if (new Date(job.scheduledAt).getTime() > now) continue;
      job.status = "sending";
      job.attemptCount = (job.attemptCount ?? 0) + 1;
      claimedIds.push(job.id);
    }
  });

  for (const jobId of claimedIds) {
    const snapshot = readDb();
    const job = snapshot.followUps.find((item) => item.id === jobId);
    const lead = job
      ? snapshot.borrowerLeads.find((item) => item.id === job.borrowerLeadId)
      : undefined;
    const officer = lead
      ? snapshot.loanOfficers.find((item) => item.id === lead.assignedLoId)
      : undefined;

    if (!job || !lead || !officer) {
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        current.status = "failed";
        current.lastError = "Lead or assigned MLO context is missing.";
      });
      failed += 1;
      continue;
    }

    // Tier-scaled automation cap (see entitlements.ts). A no-op for every
    // officer today, since entitlementTier is never populated yet — see
    // resolveOfficerEntitlement's doc comment — but real and enforced the
    // moment a live entitlement sync starts writing that field.
    const dailyLimit = automationDailyLimitFor(resolveOfficerEntitlement(officer));
    if (officerSentInLastDay(snapshot, officer.id) >= dailyLimit) {
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        // Not a failure — retry once the rolling window has room again.
        current.status = "pending";
        current.scheduledAt = new Date(Date.now() + ROLLING_DAY_MS / 24).toISOString();
        current.lastError = "Deferred: daily automation limit reached for this plan.";
      });
      events.push(`${job.plan}:${job.channel}:automation_limit_deferred`);
      continue;
    }

    try {
      const personalization = await resolveOutreachPersonalization(lead);
      const delivery = await deliverOutreach(job, { lead, officer, personalization });
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        current.status = "sent";
        current.sentAt = new Date().toISOString();
        current.deliveryProvider = delivery.provider;
        current.providerMessageId = delivery.messageId;
        current.lastError = undefined;
      });
      processed += 1;
      events.push(`${job.plan}:${job.channel}:${delivery.provider}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outreach delivery failure.";
      writeDb((db) => {
        const current = db.followUps.find((item) => item.id === jobId);
        if (!current) return;
        const attempts = current.attemptCount ?? 1;
        current.status = attempts >= 3 ? "failed" : "pending";
        current.scheduledAt = new Date(Date.now() + attempts * 60_000).toISOString();
        current.lastError = message.slice(0, 500);
      });
      failed += 1;
      events.push(`${job.plan}:${job.channel}:failed`);
    }
  }

  if (processed > 0) {
    appendAnalytics({
      type: "followup_processed",
      payload: { processedCount: processed, failedCount: failed, previews: events },
    });
  }

  return { processed, failed, events };
}
