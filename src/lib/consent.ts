import { readDb, writeDb, writeDbDurably } from "./db";
import { generateId } from "./id";
import type { ConsentChannel, ConsentRecord, DbShape } from "./types";

/**
 * Consent ledger and contact gate. Every automated message or call to a borrower must
 * pass canContact() first. This is the code side of TCPA and CAN-SPAM basics, not legal
 * advice:
 *
 * - The newest ledger record for a lead and channel wins. An opt-out (granted: false)
 *   always blocks, whatever older records or the intake form said.
 * - With no ledger record, the lead's original form consent (`legacyConsent`) decides,
 *   so leads captured before this ledger existed keep working. AI voice is the exception:
 *   it always needs its own explicit ledger grant (prior express written consent).
 * - Texts need a ledger grant captured on ypnus.com itself (the intake chat's consent question,
 *   the AI assistant, or a START reply). That is the opt-in registered with US carriers for
 *   our A2P 10DLC campaign, so a lead sent in by a partner (lead_webhook) or a bare legacy yes
 *   is never texted. Email and calls are unchanged.
 * - Texts and calls are held outside 8am to 9pm in the borrower's local time. When the
 *   time zone is unknown, both US Eastern and US Pacific must be inside that window.
 *   Email has no quiet hours.
 */

const QUIET_START_HOUR = 21; // 9pm: no texts or calls from here...
const QUIET_END_HOUR = 8; // ...until 8am local time.
const FALLBACK_TIME_ZONES = ["America/New_York", "America/Los_Angeles"];
const QUIET_HOUR_CHANNELS: ReadonlySet<ConsentChannel> = new Set(["sms", "call", "ai_voice"]);

/** Words that revoke text consent (carrier standard plus "revoke" and "opt out"). */
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt out"]);

export function isStopKeyword(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");
  return STOP_WORDS.has(normalized);
}

function localHour(now: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;
  return Number(hour);
}

/** True when `now` is outside 8am to 9pm in the given zone (or in either fallback US zone). */
export function isQuietHours(now: Date, timeZone?: string): boolean {
  const zones = timeZone ? [timeZone] : FALLBACK_TIME_ZONES;
  return zones.some((zone) => {
    const hour = localHour(now, zone);
    return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
  });
}

/** The first moment (on a 15-minute step, within 2 days) that is outside quiet hours. */
export function nextAllowedContactTime(now: Date, timeZone?: string): Date {
  const step = 15 * 60_000;
  let candidate = new Date(Math.ceil(now.getTime() / step) * step);
  for (let i = 0; i < 2 * 24 * 4; i += 1) {
    if (!isQuietHours(candidate, timeZone)) return candidate;
    candidate = new Date(candidate.getTime() + step);
  }
  return candidate;
}

export function latestConsent(
  db: Pick<DbShape, "consents">,
  borrowerLeadId: string,
  channel: ConsentChannel,
): ConsentRecord | undefined {
  let latest: ConsentRecord | undefined;
  for (const record of db.consents) {
    if (record.borrowerLeadId !== borrowerLeadId || record.channel !== channel) continue;
    if (!latest || record.at >= latest.at) latest = record;
  }
  return latest;
}

export type ContactDecision =
  | { allowed: true }
  | { allowed: false; reason: "opted_out" | "no_consent" }
  | { allowed: false; reason: "quiet_hours"; retryAt: string };

/** Consent sources that are the ypnus.com text opt-in registered with carriers. */
const SMS_OPT_IN_SOURCES = ["intake_form", "chat_assistant", "sms_start"];

function isRegisteredSmsOptIn(record: ConsentRecord): boolean {
  const source = record.source ?? "";
  return SMS_OPT_IN_SOURCES.some((prefix) => source === prefix || source.startsWith(`${prefix}:`));
}

export function canContact(input: {
  db: Pick<DbShape, "consents">;
  borrowerLeadId: string;
  channel: ConsentChannel;
  /** The consent box from the original intake, for leads with no ledger record yet. */
  legacyConsent?: boolean;
  now?: Date;
  timeZone?: string;
}): ContactDecision {
  const record = latestConsent(input.db, input.borrowerLeadId, input.channel);
  if (record && !record.granted) return { allowed: false, reason: "opted_out" };
  const consented =
    input.channel === "sms"
      ? Boolean(record?.granted && isRegisteredSmsOptIn(record))
      : record
        ? record.granted
        : input.channel !== "ai_voice" && input.legacyConsent === true;
  if (!consented) return { allowed: false, reason: "no_consent" };

  const now = input.now ?? new Date();
  if (QUIET_HOUR_CHANNELS.has(input.channel) && isQuietHours(now, input.timeZone)) {
    return { allowed: false, reason: "quiet_hours", retryAt: nextAllowedContactTime(now, input.timeZone).toISOString() };
  }
  return { allowed: true };
}

/** Appends a consent grant or opt-out. The exact wording shown is stored encrypted at rest. */
export function recordConsent(input: Omit<ConsentRecord, "id" | "at"> & { at?: string }): ConsentRecord {
  const record: ConsentRecord = { id: generateId("consent"), at: input.at ?? new Date().toISOString(), ...input };
  writeDb((db) => {
    db.consents.push(record);
  });
  return record;
}

/**
 * How a borrower's consent to be contacted was captured: where, when, and the exact wording they
 * agreed to. Written to the ledger with the lead, so "did they agree, to what, and when" can be
 * answered later from the record and not from a bare yes/no.
 */
export interface ConsentCapture {
  /** Where it was captured: "intake_form", "chat_assistant", "lead_webhook". */
  source: string;
  /** The exact wording the borrower saw or was asked. */
  textShown?: string;
  /** When they agreed. Defaults to now. */
  at?: string;
  /**
   * The channels that wording covers. Defaults to email and text (the two the intake question
   * names). A phone call is only included when the wording asked for it.
   */
  channels?: ConsentChannel[];
}

const DEFAULT_CAPTURE_CHANNELS: ConsentChannel[] = ["email", "sms"];

/**
 * The ledger entries for one lead's consent at capture: one grant per channel the wording covers
 * and the lead gave an address for. Nothing when they did not agree. AI voice is never granted
 * here: it needs its own explicit grant.
 */
export function consentRecordsForCapture(input: {
  borrowerLeadId: string;
  consented: boolean;
  email?: string;
  phone?: string;
  capture: ConsentCapture;
}): ConsentRecord[] {
  if (!input.consented) return [];
  const at = input.capture.at && !Number.isNaN(Date.parse(input.capture.at)) ? new Date(input.capture.at).toISOString() : new Date().toISOString();
  const channels = (input.capture.channels ?? DEFAULT_CAPTURE_CHANNELS).filter((channel) => {
    if (channel === "ai_voice") return false;
    return channel === "email" ? Boolean(input.email?.trim()) : Boolean(input.phone?.trim());
  });
  return [...new Set(channels)].map((channel) => ({
    id: generateId("consent"),
    borrowerLeadId: input.borrowerLeadId,
    channel,
    granted: true,
    source: input.capture.source,
    ...(input.capture.textShown ? { textShown: input.capture.textShown.slice(0, 2000) } : {}),
    at,
  }));
}

/** Writes the capture-time ledger entries for a new lead. Returns what was written. */
export function recordCaptureConsent(input: Parameters<typeof consentRecordsForCapture>[0]): ConsentRecord[] {
  const records = consentRecordsForCapture(input);
  if (records.length === 0) return records;
  writeDb((db) => {
    db.consents.push(...records);
  });
  return records;
}

/** Records an opt-out on every channel for a lead (e.g. after a STOP reply). */
export function recordOptOutAllChannels(borrowerLeadId: string, source: string): void {
  writeDb((db) => pushOptOutAllChannels(db, borrowerLeadId, source));
}

/**
 * recordOptOutAllChannels() for an opt-out the person is told succeeded (the unsubscribe link):
 * throws StoreNotDurableError when it did not reach the disk, so a restart can't bring the old
 * consent back after we said "you're unsubscribed". Memory holds the opt-out either way.
 */
export function recordOptOutAllChannelsDurably(borrowerLeadId: string, source: string): void {
  writeDbDurably((db) => pushOptOutAllChannels(db, borrowerLeadId, source));
}

function pushOptOutAllChannels(db: DbShape, borrowerLeadId: string, source: string): void {
  const at = new Date().toISOString();
  for (const channel of ["sms", "call", "email", "ai_voice"] as const) {
    db.consents.push({ id: generateId("consent"), borrowerLeadId, channel, granted: false, source, at });
  }
}

/** Read-only helper for routes and dashboards. */
export function contactDecisionFor(
  borrowerLeadId: string,
  channel: ConsentChannel,
  legacyConsent?: boolean,
): ContactDecision {
  return canContact({ db: readDb(), borrowerLeadId, channel, legacyConsent });
}

/** When a partner says consent was given: their time if it is valid and not in the future, otherwise now. */
export function partnerConsentTime(raw: string | undefined, now: Date): string {
  const at = raw ? Date.parse(raw) : Number.NaN;
  return Number.isNaN(at) || at > now.getTime() ? now.toISOString() : new Date(at).toISOString();
}
