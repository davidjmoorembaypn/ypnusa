import { HOUSE_OFFICER_ID, isDemoOfficer } from "./crm";
import { appendLoAlert } from "./db";
import { escapeHtml, notifyOwnerOfLead, sendEmail } from "./email";
import { generateId } from "./id";
import type { BorrowerAnswers, LoanOfficerRecord, LoanProgram, LoAlertRecord, QualificationSummary } from "./types";

export function notifyAssignedOfficer(payload: {
  loId: string;
  borrowerLeadId: string;
  loanProgram: LoanProgram;
  answers: BorrowerAnswers;
  qualification: QualificationSummary;
}): LoAlertRecord {
  const record: LoAlertRecord = {
    id: generateId("alert"),
    createdAt: new Date().toISOString(),
    loId: payload.loId,
    borrowerLeadId: payload.borrowerLeadId,
    loanProgram: payload.loanProgram,
    summary: summarizeBorrower(payload.answers),
    qualificationSummary: payload.qualification,
    suggestedAction: payload.qualification.recommendedNextStep,
  };

  appendLoAlert(record);
  return record;
}

/**
 * Emails a new routed lead. The house inbox (support@ypnus.com via notifyOwnerOfLead) always
 * gets a copy. The assigned MLO is emailed only when LEAD_ALERT_MLO_EMAILS=true (default
 * off: the owner hasn't approved emailing customers yet), and never for the house book or a
 * seeded demo officer. Never throws: email is a best-effort side channel, and without
 * RESEND_API_KEY every send is a logged no-op.
 */
export async function emailNewLeadAlert(payload: {
  officer: Pick<LoanOfficerRecord, "id" | "name" | "email">;
  routeReason: "zip_owner" | "house";
  borrowerLeadId: string;
  loanProgram: LoanProgram;
  answers: BorrowerAnswers;
  qualification: QualificationSummary;
}): Promise<{ ownerNotified: boolean; mloNotified: boolean }> {
  const rows: Array<[string, string]> = [
    ["Borrower", payload.answers.name ?? "Name pending"],
    ["Email", payload.answers.email ?? "—"],
    ["Phone", payload.answers.phone ?? "—"],
    ["ZIP", payload.answers.zip ?? "—"],
    ["Program", payload.loanProgram],
    ["Quality", `${payload.qualification.leadQuality} · ${payload.qualification.urgency} urgency`],
    ["Next step", payload.qualification.recommendedNextStep],
    [
      "Routed to",
      payload.routeReason === "zip_owner"
        ? `${payload.officer.name} <${payload.officer.email}> (ZIP owner)`
        : "House account (no paid owner for this ZIP)",
    ],
    ["Lead ID", payload.borrowerLeadId],
  ];
  const html = `<h2>New borrower lead</h2><table>${rows
    .map(([label, value]) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`)
    .join("")}</table>`;

  let ownerNotified = false;
  let mloNotified = false;
  try {
    ownerNotified = (await notifyOwnerOfLead({ kind: "lo_alert", summaryHtml: html, replyTo: payload.answers.email }))
      .sent;
  } catch (error) {
    console.error("[notifications] owner lead alert failed", error);
  }

  const mloEmailsOn = process.env.LEAD_ALERT_MLO_EMAILS?.trim().toLowerCase() === "true";
  if (
    mloEmailsOn &&
    payload.routeReason === "zip_owner" &&
    payload.officer.id !== HOUSE_OFFICER_ID &&
    !isDemoOfficer(payload.officer)
  ) {
    try {
      mloNotified = (
        await sendEmail({
          to: payload.officer.email,
          subject: "New borrower lead in your ZIP — YPN USA",
          html,
          replyTo: payload.answers.email,
        })
      ).sent;
    } catch (error) {
      console.error("[notifications] MLO lead alert failed", error);
    }
  }
  return { ownerNotified, mloNotified };
}

function summarizeBorrower(answers: BorrowerAnswers): string {
  return [
    answers.name ?? "Borrower name pending",
    answers.email ?? "email pending",
    answers.phone ?? "phone pending",
    `Program ${answers.loanProgram}`,
    `Intent ${answers.purchaseRefiIntent ?? "unset"}`,
  ].join(" · ");
}
