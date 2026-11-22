import { BUSINESS_EMAIL, BUSINESS_PHONE_DISPLAY } from "@/lib/author";
import { isStopKeyword, recordConsentIn, recordOptOutAllChannelsIn } from "@/lib/consent";
import { cancelPendingFollowUpsIn, readDb, writeDb } from "@/lib/db";
import { claimKeyIn, isKeyClaimedIn } from "@/lib/idempotency";

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

/**
 * One comparable form of a phone number, however it was typed. A US number (ten digits, or
 * eleven starting with the country code 1) becomes its ten digits. Anything else keeps every
 * digit, country code included, so a number from another country that happens to end in the same
 * ten digits as a borrower's US number is never treated as that borrower. Empty when it is too
 * short to be a phone number.
 */
export function phoneKey(raw: string | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length > 10 ? digits : "";
}

function keyword(body: string): string {
  return body.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
}

export function handleInboundSms(input: { from: string; body: string; messageSid?: string }): InboundSmsResult {
  const key = phoneKey(input.from);
  const matches = (phone: string | undefined) => Boolean(key) && phoneKey(phone) === key;
  const word = keyword(input.body);
  const stop = isStopKeyword(input.body);
  const start = START_WORDS.has(word);

  if (!stop && !start) {
    const leads = readDb().borrowerLeads.filter((lead) => matches(lead.answers.phone)).length;
    return HELP_WORDS.has(word) ? { action: "help", leads, reply: SMS_HELP_REPLY } : { action: "none", leads };
  }

  // One save for all of it: every lead's ledger entries, the cancelled messages and the "already
  // handled" mark, with the mark last. If the mark were saved on its own and the server stopped
  // before the rest, the carrier's retry would be skipped as a duplicate and the borrower would
  // stay subscribed.
  let result: InboundSmsResult = { action: "none", leads: 0 };
  writeDb((db) => {
    const leadIds = db.borrowerLeads.filter((lead) => matches(lead.answers.phone)).map((lead) => lead.id);
    // A redelivered message must not add a second set of ledger entries.
    if (input.messageSid && isKeyClaimedIn(db, IDEMPOTENCY_SCOPE, input.messageSid)) {
      result = { action: "duplicate", leads: leadIds.length };
      return;
    }
    for (const leadId of leadIds) {
      if (stop) {
        recordOptOutAllChannelsIn(db, leadId, "sms_stop");
        cancelPendingFollowUpsIn(db, leadId, "Cancelled: borrower opted out.");
      } else {
        recordConsentIn(db, { borrowerLeadId: leadId, channel: "sms", granted: true, source: "sms_start", textShown: input.body.trim().slice(0, 80) });
      }
    }
    if (input.messageSid) claimKeyIn(db, IDEMPOTENCY_SCOPE, input.messageSid);
    result = { action: stop ? "opted_out" : "opted_in", leads: leadIds.length };
  });
  return result;
}
