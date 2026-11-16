import { readDb, writeDb } from "./db";
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
  const consented = record ? record.granted : input.channel !== "ai_voice" && input.legacyConsent === true;
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

/** Records an opt-out on every channel for a lead (e.g. after a STOP reply). */
export function recordOptOutAllChannels(borrowerLeadId: string, source: string): void {
  const at = new Date().toISOString();
  writeDb((db) => {
    for (const channel of ["sms", "call", "email", "ai_voice"] as const) {
      db.consents.push({ id: generateId("consent"), borrowerLeadId, channel, granted: false, source, at });
    }
  });
}

/** Read-only helper for routes and dashboards. */
export function contactDecisionFor(
  borrowerLeadId: string,
  channel: ConsentChannel,
  legacyConsent?: boolean,
): ContactDecision {
  return canContact({ db: readDb(), borrowerLeadId, channel, legacyConsent });
}
