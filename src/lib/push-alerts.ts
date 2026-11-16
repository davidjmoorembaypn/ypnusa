import { HOUSE_OFFICER_ID } from "./crm";
import { readDb } from "./db";
import { queuePushToUser, type PushAlert } from "./push";
import { scoreLead } from "./scoring/lead-score";

/**
 * What loan officers get phone alerts for. Every alert is generic on purpose: no borrower
 * name, contact detail, ZIP code or amount ever goes through the push service.
 */

/**
 * Whose phones an alert for this officer goes to. The house book (leads in ZIP codes nobody
 * holds) belongs to a CRM identity, not a login, so its alerts go to the admin accounts.
 */
export function alertRecipients(officerId: string): string[] {
  if (officerId !== HOUSE_OFFICER_ID) return [officerId];
  return readDb()
    .accounts.filter((account) => account.role === "admin")
    .map((account) => account.id);
}

function alert(officerId: string, message: PushAlert): void {
  for (const userId of alertRecipients(officerId)) queuePushToUser(userId, message);
}

/** A lead was routed to the officer (first alert), or Cerebro flagged it again (later alerts). */
export function alertOfficerOfLead(input: { loId: string; borrowerLeadId: string; firstAlert: boolean }): void {
  const lead = readDb().borrowerLeads.find((item) => item.id === input.borrowerLeadId);
  if (!input.firstAlert) {
    alert(input.loId, {
      title: "A lead needs you",
      body: "Cerebro flagged a lead for your attention. Open YPN USA to see it.",
      url: "/portal/nurture",
      tag: `lead:${input.borrowerLeadId}`,
    });
    return;
  }
  const score = lead ? scoreLead({ lead }) : null;
  const hot = score?.band === "hot";
  alert(input.loId, {
    title: hot ? "New hot lead" : "New lead",
    body: score
      ? `Lead score ${score.score}/100. Open YPN USA to see who it is.`
      : "Open YPN USA to see who it is.",
    url: "/portal/nurture",
    tag: `lead:${input.borrowerLeadId}`,
  });
}

/** A borrower started chatting on the officer's own page. */
export function alertOfficerOfNewChat(officerUserId: string, sessionId: string): void {
  alert(officerUserId, {
    title: "New chat on your page",
    body: "A borrower is chatting with Cerebro. Open Live chats to read or take over.",
    url: "/portal/live-chats",
    tag: `chat:${sessionId}`,
  });
}

/** The borrower wrote while the officer has the chat (Live Takeover). */
export function alertOfficerOfChatReply(officerUserId: string, sessionId: string): void {
  alert(officerUserId, {
    title: "Borrower replied",
    body: "A borrower is waiting for your reply in Live chats.",
    url: "/portal/live-chats",
    tag: `chat:${sessionId}`,
  });
}
