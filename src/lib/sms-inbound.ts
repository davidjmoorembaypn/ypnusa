import { BUSINESS_EMAIL, BUSINESS_PHONE_DISPLAY } from "@/lib/author";
import { isStopKeyword, recordConsent, recordOptOutAllChannels } from "@/lib/consent";
import { cancelPendingFollowUps, readDb } from "@/lib/db";
import { claimKey } from "@/lib/idempotency";

/**
 * What to do with a text message a borrower sends to our number.
 *
 * - STOP (and the other carrier opt-out words): every lead with that phone number is opted out
 *   of texts, calls and email in the consent ledger, and anything still queued for them is
 *   cancelled. Nothing is sent to them again unless they opt back in.
 * - START or UNSTOP: texts are allowed again for those leads. Other channels stay as they were.
 * - HELP or INFO: a short reply saying who this is and how to reach a person or opt out.
 * - Anything else: no automated reply.
 *
 * The carrier sends its own "you are unsubscribed" confirmation for STOP, so none is sent here.
 */

const START_WORDS = new Set(["start", "unstop"]);
const HELP_WORDS = new Set(["help", "info"]);
const IDEMPOTENCY_SCOPE = "sms_inbound";

export const SMS_HELP_REPLY = `YPN USA: follow-up about your mortgage request. Help: ${BUSINESS_PHONE_DISPLAY} or ${BUSINESS_EMAIL}. Msg & data rates may apply. Reply STOP to opt out.`;

export interface InboundSmsResult {
  action: "opted_out" | "opted_in" | "help" | "none" | "duplicate";
  /** How many leads share the sender's phone number. */
  leads: number;
  /** Text to send back, when there is one. */
  reply?: string;
}

/** The last ten digits of a US phone number, however it was typed. Empty when there are fewer. */
export function phoneKey(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function keyword(body: string): string {
  return body.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
}

export function handleInboundSms(input: { from: string; body: string; messageSid?: string }): InboundSmsResult {
  const key = phoneKey(input.from);
  const leadIds = key
    ? readDb()
        .borrowerLeads.filter((lead) => phoneKey(lead.answers.phone) === key)
        .map((lead) => lead.id)
    : [];
  const word = keyword(input.body);
  const stop = isStopKeyword(input.body);
  const start = START_WORDS.has(word);

  if (HELP_WORDS.has(word)) return { action: "help", leads: leadIds.length, reply: SMS_HELP_REPLY };
  if (!stop && !start) return { action: "none", leads: leadIds.length };

  // A redelivered message must not add a second set of ledger entries.
  if (input.messageSid && !claimKey(IDEMPOTENCY_SCOPE, input.messageSid).claimed) {
    return { action: "duplicate", leads: leadIds.length };
  }

  if (stop) {
    for (const leadId of leadIds) {
      recordOptOutAllChannels(leadId, "sms_stop");
      cancelPendingFollowUps(leadId);
    }
    return { action: "opted_out", leads: leadIds.length };
  }

  for (const leadId of leadIds) {
    recordConsent({ borrowerLeadId: leadId, channel: "sms", granted: true, source: "sms_start", textShown: input.body.trim().slice(0, 80) });
  }
  return { action: "opted_in", leads: leadIds.length };
}
