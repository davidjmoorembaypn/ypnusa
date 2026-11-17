import { complianceOfficerOf } from "@/lib/ai/follow-up-tools";
import { checkMarketingCompliance } from "@/lib/ai/marketing-compliance";
import { applyComplianceGuardrails, describeBlock } from "@/lib/compliance/guardrails";
import { canContact } from "@/lib/consent";
import { borrowerFacingOfficer, HOUSE_OFFICER_ID, houseOfficerRecord } from "@/lib/crm";
import { readDb, saveCerebroAction } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { signValue, verifySignedValue } from "@/lib/session";
import { MARKETING_SITE_URL } from "@/lib/site";
import type { BorrowerLeadRecord, CerebroQueuedActionRecord, LoanOfficerRecord } from "@/lib/types";

/**
 * Sends Cerebro's follow-up emails to borrowers, so a borrower hears back while their loan
 * officer is busy.
 *
 * What goes out: check-ins, rate alerts and first replies (AUTO_SEND_KINDS). An officer in
 * "live" mode (the default) has them sent on their own; in "approve" mode only after they
 * approve. Prequal letters and callback requests never go out on their own.
 *
 * Every send, in order:
 * 1. The borrower's consent and opt-out record for the channel (src/lib/consent.ts).
 * 2. The advertising checks (no rates, payments, guarantees, invented track record).
 * 3. The shared compliance engine (src/lib/compliance): officer NMLS, company NMLS, state
 *    lines, Equal Housing, and no messages to states the officer isn't licensed in. A message
 *    sent without the officer looking at it must also have a known borrower state that the
 *    officer has listed a license for; otherwise it waits for the officer's OK.
 * 4. Email through Resend, from support@ypnus.com with the officer's name, the officer as
 *    reply-to, a line naming Cerebro as the officer's AI assistant, and a one-click
 *    unsubscribe link.
 *
 * Texts and calls are held until a texting provider is set up. Anything held for a reason that
 * can clear on its own is retried on the next pass; anything needing the officer goes back to
 * "awaiting_approval" with the reason.
 */

export const AUTO_SEND_KINDS: ReadonlySet<CerebroQueuedActionRecord["kind"]> = new Set([
  "follow_up_draft",
  "nudge_draft",
  "rate_alert_draft",
]);

/** Never more than this many emails in one pass (cost and sender-reputation guard). */
const MAX_SENDS_PER_PASS = 25;
const NMLS_PLACEHOLDER = "[add your NMLS ID]";

/**
 * Drafts queued before live replies existed were promised to wait for the officer, so only
 * items created from this moment on are ever sent without an approval.
 */
export const LIVE_REPLIES_SINCE = "2026-11-16T12:30:00Z";

/** Reserved test domains, and leads marked as tests, never get a real email. */
function isTestLead(lead: BorrowerLeadRecord): boolean {
  const domain = lead.answers.email?.split("@")[1]?.toLowerCase() ?? "";
  if (/(^|\.)(example\.(com|org|net)|test|invalid|localhost)$/.test(domain)) return true;
  return /\(claude test\)/i.test(lead.answers.name ?? "");
}

export function officerFor(loId: string): LoanOfficerRecord {
  const found = readDb().loanOfficers.find((officer) => officer.id === loId);
  if (!found) return houseOfficerRecord();
  return borrowerFacingOfficer(loId === HOUSE_OFFICER_ID ? { ...houseOfficerRecord(), ...found } : found);
}

export function replyModeFor(officer: LoanOfficerRecord): "live" | "approve" {
  return officer.cerebroReplyMode === "approve" ? "approve" : "live";
}

export function unsubscribeToken(borrowerLeadId: string): string {
  return signValue(`unsub:${borrowerLeadId}`);
}

export function verifyUnsubscribeToken(borrowerLeadId: string, token: string): boolean {
  return Boolean(borrowerLeadId && token) && verifySignedValue(`unsub:${borrowerLeadId}`, token);
}

export function unsubscribeUrl(borrowerLeadId: string): string {
  const params = new URLSearchParams({ l: borrowerLeadId, t: unsubscribeToken(borrowerLeadId) });
  return `${MARKETING_SITE_URL}/unsubscribe?${params.toString()}`;
}

function oneClickUrl(borrowerLeadId: string): string {
  const params = new URLSearchParams({ l: borrowerLeadId, t: unsubscribeToken(borrowerLeadId) });
  return `${MARKETING_SITE_URL}/api/unsubscribe?${params.toString()}`;
}

export function emailHtml(body: string, officer: LoanOfficerRecord, borrowerLeadId: string, sentWithoutReview: boolean): string {
  const firstName = officer.name.split(/\s+/)[0] || officer.name;
  const header = sentWithoutReview
    ? `<p style="font-size:13px;color:#555;margin:0 0 16px">Sent by Cerebro, the AI assistant for ${escapeHtml(officer.name)}. Reply to reach ${escapeHtml(firstName)} directly.</p>`
    : "";
  const text = escapeHtml(body).replace(/\n/g, "<br>");
  const footer = [
    sentWithoutReview
      ? `Cerebro is an AI assistant. It can't quote rates or make loan decisions; ${escapeHtml(firstName)} handles those.`
      : `Sent with the help of Cerebro, ${escapeHtml(firstName)}'s AI assistant.`,
    `<a href="${escapeHtml(unsubscribeUrl(borrowerLeadId))}">Unsubscribe</a> from these emails.`,
  ].join("<br>");
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#13254a">${header}${text}<hr style="border:none;border-top:1px solid #ddd;margin:20px 0"><p style="font-size:12px;color:#666">${footer}</p></div>`;
}

export type DispatchDecision =
  | { action: "send"; to: string; subject: string; body: string; sentWithoutReview: boolean }
  /** Can clear on its own (quiet hours, no provider yet): retried next pass. */
  | { action: "hold"; reason: string }
  /** Needs the officer: goes back to their approval queue with the reason. */
  | { action: "needs_officer"; reason: string }
  | { action: "skip" };

/** Pure decision for one queued item. */
export function decideDispatch(
  action: CerebroQueuedActionRecord,
  lead: BorrowerLeadRecord | undefined,
  officer: LoanOfficerRecord,
  db: ReturnType<typeof readDb>,
  now: Date,
): DispatchDecision {
  if (!AUTO_SEND_KINDS.has(action.kind) || action.status === "dismissed" || action.status === "sent") return { action: "skip" };
  const approved = action.status === "approved" || Boolean(action.approvedAt);
  const live = replyModeFor(officer) === "live";
  // Waiting on the officer: either they asked to approve first, or it was sent back with a reason.
  if (action.status === "awaiting_approval" && (!live || action.holdReason)) return { action: "skip" };
  if (action.status === "held" && !approved && !live) return { action: "skip" };
  if (!lead) return { action: "needs_officer", reason: "Needs your OK: the lead no longer exists." };
  // Written for another officer before the lead moved (a ZIP code claim or a reroute): never send it.
  if (lead.assignedLoId !== action.loId) return { action: "skip" };
  if (isTestLead(lead)) return { action: "skip" };
  if (!approved && Date.parse(action.createdAt) < Date.parse(LIVE_REPLIES_SINCE)) {
    return action.status === "awaiting_approval" ? { action: "skip" } : { action: "needs_officer", reason: "Needs your OK: drafted before Cerebro sent emails on its own." };
  }

  const consentChannel = action.channel === "email" ? "email" : action.channel === "text" ? "sms" : "call";
  const contact = canContact({ db, borrowerLeadId: lead.id, channel: consentChannel, legacyConsent: lead.answers.contactConsent === true, now });
  if (!contact.allowed) {
    if (contact.reason === "quiet_hours") return { action: "hold", reason: "Outside 8am to 9pm; will retry." };
    return { action: "needs_officer", reason: contact.reason === "opted_out" ? "Needs your OK: the borrower opted out, so it won't be sent." : "Needs your OK: no consent on record to contact them this way." };
  }
  if (action.channel !== "email") return { action: "hold", reason: "Texts and calls wait until texting is set up." };
  const to = lead.answers.email?.trim();
  if (!to) return { action: "needs_officer", reason: "Needs your OK: no email address on the lead." };
  if (action.body.includes(NMLS_PLACEHOLDER)) return { action: "needs_officer", reason: "Needs your OK: add your NMLS ID to your profile first." };

  const problems = checkMarketingCompliance({ fields: { message: `${action.subject ?? ""}\n${action.body}` }, nmlsId: officer.nmlsId });
  if (problems.length) return { action: "needs_officer", reason: `Needs your OK: ${problems[0]}` };

  const guarded = applyComplianceGuardrails({ text: action.body, channel: "email", officer: complianceOfficerOf(officer), zip: lead.answers.zip });
  if (guarded.blocked) return { action: "needs_officer", reason: `Needs your OK: ${describeBlock(guarded.reasons[0], guarded.state)}` };
  const sentWithoutReview = !approved;
  if (sentWithoutReview) {
    // Nobody looked at it: require a known state the officer is licensed in.
    if (!guarded.state) return { action: "needs_officer", reason: "Needs your OK: the borrower's state isn't known." };
    if (!(officer.licenses ?? []).some((license) => license.state.toUpperCase() === guarded.state)) {
      return { action: "needs_officer", reason: `Needs your OK: list your license for ${guarded.state} in your profile, or approve this one yourself.` };
    }
  }
  return { action: "send", to, subject: action.subject ?? `A note from ${officer.name}`, body: guarded.text, sentWithoutReview };
}

export interface DispatchResult {
  sent: number;
  held: number;
  toOfficer: number;
}

/** One pass over the queue. Never throws for a single item; each item records why it waited. */
export async function dispatchCerebroMessages(now = new Date(), send: typeof sendEmail = sendEmail): Promise<DispatchResult> {
  const db = readDb();
  const leads = new Map(db.borrowerLeads.map((lead) => [lead.id, lead]));
  const result: DispatchResult = { sent: 0, held: 0, toOfficer: 0 };
  const stamp = now.toISOString();

  for (const action of db.cerebroActions) {
    if (result.sent >= MAX_SENDS_PER_PASS) break;
    const officer = officerFor(action.loId);
    const decision = decideDispatch(action, leads.get(action.borrowerLeadId), officer, db, now);
    if (decision.action === "skip") continue;
    if (decision.action === "hold") {
      if (action.status !== "held" || action.holdReason !== decision.reason) {
        saveCerebroAction({ ...action, status: "held", holdReason: decision.reason, updatedAt: stamp });
      }
      result.held++;
      continue;
    }
    if (decision.action === "needs_officer") {
      saveCerebroAction({ ...action, status: "awaiting_approval", holdReason: decision.reason, updatedAt: stamp });
      result.toOfficer++;
      continue;
    }
    const outcome = await send({
      to: decision.to,
      subject: decision.subject,
      html: emailHtml(decision.body, officer, action.borrowerLeadId, decision.sentWithoutReview),
      replyTo: officer.email,
      fromName: `${officer.name} via YPN USA`,
      headers: {
        "List-Unsubscribe": `<${oneClickUrl(action.borrowerLeadId)}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
    if (!outcome.sent) {
      saveCerebroAction({ ...action, status: "held", holdReason: `Email didn't send: ${outcome.reason ?? "unknown error"}`, updatedAt: stamp });
      result.held++;
      continue;
    }
    saveCerebroAction({ ...action, status: "sent", body: decision.body, sentAt: stamp, holdReason: undefined, updatedAt: stamp });
    result.sent++;
  }
  return result;
}

let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;

/** Every 5 minutes, sends what is due. Off with CEREBRO_DISPATCH_DISABLED=true. */
export function startCerebroDispatchSchedule(): void {
  if (timer || process.env.CEREBRO_DISPATCH_DISABLED === "true") return;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const result = await dispatchCerebroMessages();
      if (result.sent || result.toOfficer) console.log(`[cerebro-dispatch] sent ${result.sent}, held ${result.held}, back to officer ${result.toOfficer}`);
    } catch (error) {
      console.error("[cerebro-dispatch] pass failed", error instanceof Error ? error.message : error);
    } finally {
      busy = false;
    }
  };
  timer = setInterval(() => void tick(), 5 * 60 * 1000);
  timer.unref?.();
  setTimeout(() => void tick(), 90_000).unref?.();
}
