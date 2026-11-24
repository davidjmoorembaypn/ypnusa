import type {
  BorrowerLeadRecord,
  FollowUpPlan,
  LoanOfficerRecord,
  ScheduledFollowUpRecord,
} from "./types";
import type { PersonalizationSummary } from "./personalization/personalizationEngine";
import { OUTBOUND_TIMEOUT_MS } from "./outbound";
import { checkMarketingCompliance } from "./ai/marketing-compliance";
import { BUSINESS_ADDRESS_LINE, BUSINESS_NAME } from "./business-profile";
import { applyComplianceGuardrails, describeBlock } from "./compliance/guardrails";
import { escapeHtml, sendEmail } from "./email";
import { borrowerFacingOfficer } from "./crm";
import { unsubscribeHeaders, unsubscribeUrl } from "./unsubscribe-link";

export interface OutreachContext {
  lead: BorrowerLeadRecord;
  officer: LoanOfficerRecord;
  /** Optional ZIP-derived personalization (src/lib/personalization/personalizationEngine.ts). */
  personalization?: PersonalizationSummary;
}

/**
 * No delivery provider is configured. In production this must never be treated
 * as a successful send: the follow-up stays pending and is retried once a
 * provider (Resend, SendGrid, Twilio or OUTREACH_WEBHOOK_URL) is configured.
 */
export class OutreachNotConfiguredError extends Error {
  constructor(channel: string) {
    super(`No ${channel} outreach provider is configured.`);
    this.name = "OutreachNotConfiguredError";
  }
}

/**
 * This message must not go out as written: the officer's NMLS ID is missing, the borrower is in a
 * state the officer is not licensed in, or the wording fails the advertising check. Not a delivery
 * failure and not retried: the job is cancelled with the reason.
 */
export class OutreachBlockedError extends Error {
  constructor(readonly reason: string) {
    super(`Outreach blocked: ${reason}`);
    this.name = "OutreachBlockedError";
  }
}

export interface OutreachDeliveryResult {
  provider: "twilio" | "sendgrid" | "resend" | "webhook" | "demo";
  messageId?: string;
}

const outreachCopy: Record<FollowUpPlan, (firstName: string, officerName: string) => string> = {
  immediate_confirmation_email: (firstName, officerName) =>
    `Hi ${firstName}, I’m the YPN USA virtual assistant for ${officerName}. I received your mortgage request and can help you choose a time for a quick call.`,
  immediate_sms_ack: (firstName, officerName) =>
    `YPN USA: Hi ${firstName}, thanks for your mortgage request. You're signed up for texts about it from ${officerName}'s team (call scheduling, reminders, follow-ups). Msg frequency varies. Msg & data rates may apply. Reply HELP for help. Reply STOP to opt out.`,
  day_1_educational_email: (firstName, officerName) =>
    `Hi ${firstName}, ${officerName} is ready to help. Reply with any mortgage questions or choose an available consultation time in your YPN USA conversation.`,
  day_3_book_call_email: (firstName, officerName) =>
    `Hi ${firstName}, would you like to reserve a short call with ${officerName}? Your YPN USA assistant can show current openings.`,
  day_5_urgency_email: (firstName, officerName) =>
    `Hi ${firstName}, timing and rates can change quickly. ${officerName} can review your options whenever you are ready.`,
  day_30_check_in: (firstName, officerName) =>
    `Hi ${firstName}, checking in from ${officerName}’s YPN USA team. Has your home financing timeline changed in the last month?`,
  day_60_check_in: (firstName, officerName) =>
    `Hi ${firstName}, are you any closer to a purchase or refinance decision? ${officerName} can refresh your options and next steps.`,
  day_90_check_in: (firstName, officerName) =>
    `Hi ${firstName}, this is your 90-day YPN USA check-in. Reply if you would like ${officerName} to prepare an updated mortgage game plan.`,
};

function firstName(name?: string): string {
  return name?.trim().split(/\s+/)[0] || "there";
}

/** One extra line appended when ZIP-derived personalization is available. */
function formatPersonalizationLine(personalization: PersonalizationSummary): string {
  return `\n\n${personalization.whyThisMattersForYou}`;
}

export function composeOutreach(
  plan: FollowUpPlan,
  context: OutreachContext,
): { subject: string; body: string } {
  // A seeded demo officer never reaches a real borrower by name (see crm.ts borrowerFacingOfficer).
  const officer = borrowerFacingOfficer(context.officer);
  const base = outreachCopy[plan](firstName(context.lead.answers.name), officer.name);
  const body = context.personalization ? `${base}${formatPersonalizationLine(context.personalization)}` : base;

  return {
    subject: `Your mortgage next steps with ${officer.name}`,
    body,
  };
}

/** A journey message ready to send: disclosures added, and for email the unsubscribe link and postal address. */
export interface PreparedOutreach {
  subject: string;
  /** Plain text. For a text message this is the whole message. */
  text: string;
  /** Email only. */
  html?: string;
  headers?: Record<string, string>;
  replyTo?: string;
  fromName?: string;
  /** The disclosure lines that were added (NMLS IDs, state lines, Equal Housing). */
  disclosures: string[];
  /** Email only: the borrower's one-click way out. */
  unsubscribeUrl?: string;
}

const STOP_LINE = /Reply STOP to opt out/i;

/**
 * Turns a journey step into a message that may go to a borrower, through the same checks as
 * Cerebro's emails (src/lib/cerebro-dispatch.ts):
 *
 * 1. The advertising check: no rates, payments, guarantees or invented track record.
 * 2. The compliance engine (src/lib/compliance): the officer's NMLS ID, the company's NMLS ID,
 *    state lines and Equal Housing are added; a missing NMLS ID or a borrower in a state the
 *    officer is not licensed in blocks the message.
 * 3. Email gets an unsubscribe link (in the body and as one-click headers), the sender's postal
 *    address, and the officer as reply-to. A text always ends with the STOP line.
 *
 * Throws OutreachBlockedError when the message must not go out.
 */
export function prepareOutreach(job: ScheduledFollowUpRecord, context: OutreachContext): PreparedOutreach {
  const officer = borrowerFacingOfficer(context.officer);
  const { subject, body } = composeOutreach(job.plan, { ...context, officer });

  const problems = checkMarketingCompliance({ fields: { message: `${subject}\n${body}` }, nmlsId: officer.nmlsId });
  if (problems.length > 0) throw new OutreachBlockedError(problems[0]);

  const isSms = job.channel === "sms";
  const guarded = applyComplianceGuardrails({
    text: body,
    channel: isSms ? "sms" : "email",
    officer: {
      name: officer.name,
      nmlsId: officer.nmlsId,
      company: officer.company,
      companyNmlsId: officer.companyNmlsId,
      licenses: officer.licenses,
      equalHousing: officer.equalHousing,
    },
    zip: context.lead.answers.zip,
  });
  if (guarded.blocked) throw new OutreachBlockedError(describeBlock(guarded.reasons[0], guarded.state));
  // The journey's later emails and texts go out with nobody reviewing them, so when the
  // borrower's state is known the officer must have listed a license there. An empty license
  // list is only a warning in the guardrails; here it blocks. The instant "we got your
  // request" reply is an answer to the borrower, so it still goes out.
  if (
    !job.plan.startsWith("immediate_") &&
    guarded.state &&
    !(officer.licenses ?? []).some((license) => license.state.toUpperCase() === guarded.state)
  ) {
    throw new OutreachBlockedError(describeBlock("not_licensed_in_state", guarded.state));
  }

  if (isSms) {
    const text = STOP_LINE.test(guarded.text) ? guarded.text : `${guarded.text.trimEnd()} Reply STOP to opt out.`;
    return { subject, text, disclosures: guarded.appended };
  }

  const leadId = context.lead.id;
  const leave = unsubscribeUrl(leadId);
  const sender = `${BUSINESS_NAME}, ${BUSINESS_ADDRESS_LINE}`;
  const footerText = [
    `Sent by the YPN USA virtual assistant for ${officer.name}. Reply to this email to reach them.`,
    `Unsubscribe: ${leave}`,
    sender,
  ];
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#13254a">` +
    `<p>${escapeHtml(guarded.text).replace(/\n/g, "<br>")}</p>` +
    `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">` +
    `<p style="font-size:12px;color:#666">${escapeHtml(footerText[0])}<br>` +
    `<a href="${escapeHtml(leave)}">Unsubscribe</a> from these emails.<br>${escapeHtml(sender)}</p></div>`;
  return {
    subject,
    text: `${guarded.text}\n\n${footerText.join("\n")}`,
    html,
    headers: unsubscribeHeaders(leadId),
    replyTo: officer.email,
    fromName: `${officer.name} via ${BUSINESS_NAME}`,
    disclosures: guarded.appended,
    unsubscribeUrl: leave,
  };
}

async function responseMessageId(response: Response): Promise<string | undefined> {
  const headerId =
    response.headers.get("x-message-id") ??
    response.headers.get("x-request-id") ??
    response.headers.get("location");
  if (headerId) return headerId;

  try {
    const body = (await response.json()) as { sid?: string; id?: string };
    return body.sid ?? body.id;
  } catch (error) {
    // Delivery already succeeded; only the provider reference is unavailable.
    console.warn(
      "[outreach] Could not read a provider message id from the delivery response.",
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

async function assertSuccessful(response: Response, provider: string): Promise<void> {
  if (response.ok) return;
  const detail = (await response.text()).slice(0, 300);
  throw new Error(`${provider} rejected outreach (${response.status}): ${detail || response.statusText}`);
}

async function deliverWebhook(
  job: ScheduledFollowUpRecord,
  context: OutreachContext,
  prepared: PreparedOutreach,
  url: string,
): Promise<OutreachDeliveryResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "borrower.outreach",
      followUpId: job.id,
      borrowerLeadId: job.borrowerLeadId,
      assignedMlo: {
        id: context.officer.id,
        name: context.officer.name,
        email: context.officer.email,
      },
      channel: job.channel,
      recipient: job.recipient,
      plan: job.plan,
      subject: prepared.subject,
      // The full message: disclosures, and for email the unsubscribe line and postal address.
      // Whatever sends this must send it whole.
      body: prepared.text,
      html: prepared.html,
      headers: prepared.headers,
      replyTo: prepared.replyTo,
      unsubscribeUrl: prepared.unsubscribeUrl,
      disclosures: prepared.disclosures,
    }),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
  });
  await assertSuccessful(response, "Outreach webhook");
  return { provider: "webhook", messageId: await responseMessageId(response) };
}

async function deliverTwilio(
  job: ScheduledFollowUpRecord,
  body: string,
  accountSid: string,
  authToken: string,
  fromNumber: string,
): Promise<OutreachDeliveryResult> {
  const form = new URLSearchParams({ To: job.recipient, From: fromNumber, Body: body });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    },
  );
  await assertSuccessful(response, "Twilio");
  return { provider: "twilio", messageId: await responseMessageId(response) };
}

async function deliverResend(job: ScheduledFollowUpRecord, prepared: PreparedOutreach): Promise<OutreachDeliveryResult> {
  const result = await sendEmail({
    to: job.recipient,
    subject: prepared.subject,
    html: prepared.html ?? `<p>${escapeHtml(prepared.text).replace(/\n/g, "<br>")}</p>`,
    replyTo: prepared.replyTo,
    fromName: prepared.fromName,
    headers: prepared.headers,
  });
  if (!result.sent) throw new Error(`Resend delivery failed: ${result.reason ?? "unknown error"}`);
  return { provider: "resend", messageId: `resend_${job.id}` };
}

async function deliverSendGrid(
  job: ScheduledFollowUpRecord,
  prepared: PreparedOutreach,
  apiKey: string,
  fromEmail: string,
): Promise<OutreachDeliveryResult> {
  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: job.recipient }] }],
      from: { email: fromEmail, name: prepared.fromName ?? "YPN USA" },
      ...(prepared.replyTo ? { reply_to: { email: prepared.replyTo } } : {}),
      subject: prepared.subject,
      content: [
        { type: "text/plain", value: prepared.text },
        ...(prepared.html ? [{ type: "text/html", value: prepared.html }] : []),
      ],
      ...(prepared.headers ? { headers: prepared.headers } : {}),
    }),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
  });
  await assertSuccessful(response, "SendGrid");
  return { provider: "sendgrid", messageId: await responseMessageId(response) };
}

export async function deliverOutreach(
  job: ScheduledFollowUpRecord,
  context: OutreachContext,
): Promise<OutreachDeliveryResult> {
  context = { ...context, officer: borrowerFacingOfficer(context.officer) };
  // Throws OutreachBlockedError before any provider is contacted.
  const prepared = prepareOutreach(job, context);
  const webhookUrl = process.env.OUTREACH_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    return deliverWebhook(job, context, prepared, webhookUrl);
  }

  if (job.channel === "sms") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
    const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
    if (accountSid && authToken && fromNumber) {
      return deliverTwilio(job, prepared.text, accountSid, authToken, fromNumber);
    }
  } else {
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
    if (apiKey && fromEmail) {
      return deliverSendGrid(job, prepared, apiKey, fromEmail);
    }
    if (process.env.RESEND_API_KEY?.trim()) {
      return deliverResend(job, prepared);
    }
  }

  // Never report a send that did not happen in production.
  if (process.env.NODE_ENV === "production") {
    throw new OutreachNotConfiguredError(job.channel === "sms" ? "SMS" : "email");
  }
  return { provider: "demo", messageId: `demo_${job.id}` };
}
