import { checkMarketingCompliance } from "@/lib/ai/marketing-compliance";
import { AUTO_SEND_KINDS } from "@/lib/cerebro-dispatch";
import { listCerebroActions, readDb, saveCerebroAction } from "@/lib/db";
import type { CerebroQueuedActionRecord, LoanOfficerRecord } from "@/lib/types";

/**
 * A loan officer's approval queue: what Cerebro drafted and is waiting on them for. One place for
 * the rules, used by the dashboard page (/dashboard/approvals) and by Cerebro's chat tools, so
 * both decide an item the same way.
 */

export const MAX_EDITED_BODY = 2000;
export const MAX_EDITED_SUBJECT = 200;

export const QUEUE_KIND_LABEL: Record<CerebroQueuedActionRecord["kind"], string> = {
  callback_request: "Callback request",
  follow_up_draft: "First reply",
  nudge_draft: "Check-in",
  rate_alert_draft: "Rate alert",
  prequal_request: "Prequalification request",
  prequal_letter_draft: "Prequalification letter",
};

export interface QueueItem {
  id: string;
  kind: CerebroQueuedActionRecord["kind"];
  borrower: string;
  channel: CerebroQueuedActionRecord["channel"];
  preferredWindow?: string;
  /** Why it is waiting, in plain words, when Cerebro sent it back. */
  needsYou?: string;
  subject?: string;
  body: string;
  createdAt: string;
  /** Changes whenever the draft does. Sent back with a decision so an unseen rewrite is never approved. */
  version: string;
  /** True when approving makes Cerebro email it; false when the officer sends it themselves. */
  cerebroSends: boolean;
}

export interface SentItem {
  borrower: string;
  kind: CerebroQueuedActionRecord["kind"];
  subject?: string;
  sentAt?: string;
}

export interface QueueView {
  replyMode: "live" | "approve";
  waiting: QueueItem[];
  recentlySent: SentItem[];
  /** Approved or automatic items waiting on something that clears by itself (quiet hours, no provider). */
  waitingToSend: number;
}

/** Cerebro emails these itself once approved; every other kind is handed to the officer to send. */
export function cerebroSendsIt(action: Pick<CerebroQueuedActionRecord, "kind" | "channel">): boolean {
  return action.channel === "email" && AUTO_SEND_KINDS.has(action.kind);
}

/**
 * Waiting on the officer: anything awaiting their approval, plus a text or call script that
 * Cerebro put on hold because it cannot send those. Without the second part such a script would
 * sit on hold for good and the borrower would never hear back.
 */
export function needsOfficer(action: Pick<CerebroQueuedActionRecord, "status" | "channel" | "approvedAt">): boolean {
  if (action.status === "awaiting_approval") return true;
  return action.status === "held" && action.channel !== "email" && !action.approvedAt;
}

export function officerForEmail(email: string | undefined): LoanOfficerRecord | undefined {
  const wanted = email?.trim().toLowerCase();
  if (!wanted) return undefined;
  return readDb().loanOfficers.find((officer) => officer.email.trim().toLowerCase() === wanted);
}

export function queueViewFor(officer: LoanOfficerRecord): QueueView {
  const leads = new Map(readDb().borrowerLeads.map((lead) => [lead.id, lead]));
  const borrower = (id: string) => leads.get(id)?.answers.name ?? "Unnamed lead";
  const mine = listCerebroActions(officer.id);
  return {
    replyMode: officer.cerebroReplyMode === "approve" ? "approve" : "live",
    waiting: mine
      .filter(needsOfficer)
      .slice(-20)
      .map((action) => ({
        id: action.id,
        kind: action.kind,
        borrower: borrower(action.borrowerLeadId),
        channel: action.channel,
        preferredWindow: action.preferredWindow,
        // On an item held because Cerebro cannot send it, the hold note is not something to fix.
        needsYou: action.status === "awaiting_approval" ? action.holdReason : undefined,
        subject: action.subject,
        body: action.body,
        createdAt: action.createdAt,
        version: action.updatedAt,
        cerebroSends: cerebroSendsIt(action),
      })),
    recentlySent: mine
      .filter((action) => action.status === "sent")
      .slice(-10)
      .map((action) => ({ borrower: borrower(action.borrowerLeadId), kind: action.kind, subject: action.subject, sentAt: action.sentAt })),
    waitingToSend: mine.filter((action) => action.status === "held" && !needsOfficer(action)).length,
  };
}

export type QueueDecision = "approve" | "dismiss";

export type QueueDecisionResult =
  | { ok: true; decision: QueueDecision; cerebroSends: boolean; finalText: string }
  | { ok: false; code: "NOT_FOUND" }
  | { ok: false; code: "ALREADY_DECIDED"; status: CerebroQueuedActionRecord["status"] }
  /** The draft was rewritten after the officer's page loaded (a borrower changed their request). Nothing changed. */
  | { ok: false; code: "CHANGED" }
  /** The wording breaks an advertising rule, so it was not approved. Nothing changed. */
  | { ok: false; code: "NEEDS_CHANGES"; problems: string[] };

/**
 * Approves or dismisses one waiting item in this officer's own queue. An item in another
 * officer's queue is reported as not found.
 *
 * An email Cerebro will send is checked against the advertising rules here, with the officer's
 * edit applied, so they hear about a problem now instead of having the item come back five
 * minutes later. The send itself repeats that check, plus consent and licensing
 * (decideDispatch). Kinds the officer sends from their own phone or email are not checked: a
 * prequalification letter, for one, has to state amounts.
 */
export function decideQueuedAction(input: {
  officer: LoanOfficerRecord;
  actionId: string;
  decision: QueueDecision;
  editedBody?: string;
  /** New subject line for an email. Ignored for an item that has no subject. */
  editedSubject?: string;
  /** The `version` the officer was looking at. When given and out of date, nothing is decided. */
  seenVersion?: string;
  now?: Date;
}): QueueDecisionResult {
  const action = listCerebroActions(input.officer.id).find((item) => item.id === input.actionId);
  if (!action) return { ok: false, code: "NOT_FOUND" };
  if (!needsOfficer(action)) return { ok: false, code: "ALREADY_DECIDED", status: action.status };
  if (input.seenVersion !== undefined && input.seenVersion !== action.updatedAt) return { ok: false, code: "CHANGED" };

  const edited = input.editedBody?.trim().slice(0, MAX_EDITED_BODY);
  const body = edited ? edited : action.body;
  const editedSubject = input.editedSubject?.replace(/\s+/g, " ").trim().slice(0, MAX_EDITED_SUBJECT);
  const subject = action.subject !== undefined && editedSubject ? editedSubject : action.subject;
  const cerebroSends = input.decision === "approve" && cerebroSendsIt(action);
  if (cerebroSends) {
    const problems = checkMarketingCompliance({ fields: { message: `${subject ?? ""}\n${body}` }, nmlsId: input.officer.nmlsId });
    if (problems.length) return { ok: false, code: "NEEDS_CHANGES", problems };
  }

  const stamp = (input.now ?? new Date()).toISOString();
  saveCerebroAction({
    ...action,
    status: input.decision === "approve" ? "approved" : "dismissed",
    body,
    ...(subject !== undefined ? { subject } : {}),
    ...(input.decision === "approve" ? { approvedAt: stamp } : {}),
    holdReason: undefined,
    updatedAt: stamp,
  });
  return { ok: true, decision: input.decision, cerebroSends, finalText: body };
}
