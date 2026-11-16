import type { BorrowerLeadRecord, ChatSessionRecord } from "../types";

/**
 * Lead score (upgrade 5.1): a deterministic 0-100 "how ready is this borrower to talk now"
 * number for the loan officer's lead list, built only from data YPN already holds.
 * Same inputs always give the same score, and every point comes with a plain-English reason.
 *
 * Fair lending: the score deliberately ignores ZIP code, name, age, marital or family status,
 * veteran status and income. ZIP code can stand in for race, and marital status is protected
 * under ECOA / Reg B. It only orders who to call first; it never decides who gets a loan,
 * a price or an offer.
 *
 * Points (max 100):
 *   timeline 25 · engagement 20 · booked call 15 · reachable 15 · readiness 15 · recency 10
 */

export interface LeadScoreReason {
  /** Plain English, shown on the lead card. Never contains contact details. */
  label: string;
  points: number;
}

export interface LeadScore {
  score: number;
  band: "hot" | "warm" | "nurture";
  /** Every positive contribution, largest first. */
  reasons: LeadScoreReason[];
}

export interface LeadScoreInput {
  lead: Pick<BorrowerLeadRecord, "createdAt" | "answers" | "prequalRequest" | "rateAlerts">;
  /** The borrower's Cerebro chat, when the lead came from one. */
  chat?: Pick<ChatSessionRecord, "messages">;
  /** True when the borrower has a call booked with the officer. */
  hasAppointment?: boolean;
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timelinePoints(timeline?: string): LeadScoreReason | null {
  switch (timeline) {
    case "lt_30":
      return { label: "Wants to move in under 30 days", points: 25 };
    case "1_3_months":
      return { label: "Wants to move in 1 to 3 months", points: 18 };
    case "3_6_months":
      return { label: "Wants to move in 3 to 6 months", points: 10 };
    default:
      return timeline ? { label: "Longer or unsure timeline", points: 3 } : null;
  }
}

function engagementReasons(input: LeadScoreInput): LeadScoreReason[] {
  const reasons: LeadScoreReason[] = [];
  const borrowerMessages = input.chat?.messages.filter((message) => message.role === "user").length ?? 0;
  if (borrowerMessages >= 6) reasons.push({ label: `Active in chat (${borrowerMessages} messages)`, points: 12 });
  else if (borrowerMessages >= 3) reasons.push({ label: `Engaged in chat (${borrowerMessages} messages)`, points: 8 });
  else if (borrowerMessages >= 1) reasons.push({ label: "Started a chat", points: 4 });
  if (input.lead.prequalRequest) reasons.push({ label: "Asked for a prequal letter", points: 8 });
  if (input.lead.rateAlerts && !input.lead.rateAlerts.optedOutAt) {
    reasons.push({ label: "Signed up for rate alerts", points: 3 });
  }
  return capGroup(reasons, 20);
}

function reachableReasons(input: LeadScoreInput): LeadScoreReason[] {
  const { phone, email, contactConsent } = input.lead.answers;
  if (!phone && !email) return [];
  if (!contactConsent) return [{ label: "Left contact details (no consent to contact yet)", points: 3 }];
  if (phone && email) return [{ label: "Agreed to be contacted by phone and email", points: 15 }];
  if (phone) return [{ label: "Agreed to be contacted by phone", points: 12 }];
  return [{ label: "Agreed to be contacted by email", points: 9 }];
}

function readinessReasons(input: LeadScoreInput): LeadScoreReason[] {
  const { answers } = input.lead;
  const prequal = input.lead.prequalRequest;
  const reasons: LeadScoreReason[] = [];
  switch (answers.estimatedCreditBand) {
    case "740-850":
      reasons.push({ label: "Self-reported credit 740+", points: 7 });
      break;
    case "670-739":
      reasons.push({ label: "Self-reported credit 670 to 739", points: 5 });
      break;
    case "620-669":
      reasons.push({ label: "Self-reported credit 620 to 669", points: 3 });
      break;
    case "580-619":
      reasons.push({ label: "Self-reported credit 580 to 619", points: 2 });
      break;
    default:
      break;
  }
  const hasDownPayment = (answers.estimatedDownPaymentUsd ?? 0) > 0 || Boolean(prequal?.downPayment);
  if (hasDownPayment && answers.purchaseRefiIntent !== "refinance") {
    reasons.push({ label: "Has a down payment saved", points: 4 });
  }
  if ((prequal?.docsReady?.length ?? 0) > 0) reasons.push({ label: "Has documents ready", points: 4 });
  return capGroup(reasons, 15);
}

function recencyReason(createdAt: string, now: Date): LeadScoreReason | null {
  const age = now.getTime() - Date.parse(createdAt);
  if (!Number.isFinite(age)) return null;
  if (age <= DAY_MS) return { label: "New in the last 24 hours", points: 10 };
  if (age <= 3 * DAY_MS) return { label: "New this week", points: 7 };
  if (age <= 7 * DAY_MS) return { label: "Came in within 7 days", points: 4 };
  if (age <= 30 * DAY_MS) return { label: "Came in within 30 days", points: 2 };
  return null;
}

/** Trims a group so its points never exceed the cap, keeping the largest reasons. */
function capGroup(reasons: LeadScoreReason[], cap: number): LeadScoreReason[] {
  const sorted = [...reasons].sort((a, b) => b.points - a.points);
  const kept: LeadScoreReason[] = [];
  let total = 0;
  for (const reason of sorted) {
    const room = cap - total;
    if (room <= 0) break;
    const points = Math.min(reason.points, room);
    kept.push({ ...reason, points });
    total += points;
  }
  return kept;
}

export function bandForScore(score: number): LeadScore["band"] {
  if (score >= 70) return "hot";
  if (score >= 45) return "warm";
  return "nurture";
}

export function scoreLead(input: LeadScoreInput): LeadScore {
  const now = input.now ?? new Date();
  const reasons: LeadScoreReason[] = [];
  const timeline = timelinePoints(input.lead.answers.timeline);
  if (timeline) reasons.push(timeline);
  reasons.push(...engagementReasons(input));
  if (input.hasAppointment) reasons.push({ label: "Booked a call", points: 15 });
  reasons.push(...reachableReasons(input));
  reasons.push(...readinessReasons(input));
  const recency = recencyReason(input.lead.createdAt, now);
  if (recency) reasons.push(recency);

  const positive = reasons.filter((reason) => reason.points > 0).sort((a, b) => b.points - a.points);
  const score = Math.max(0, Math.min(100, positive.reduce((total, reason) => total + reason.points, 0)));
  return { score, band: bandForScore(score), reasons: positive };
}
