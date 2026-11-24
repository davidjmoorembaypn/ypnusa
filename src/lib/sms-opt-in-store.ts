import { readDb, writeDb } from "./db";
import { generateId } from "./id";
import type { DbShape, SmsOptInRecord } from "./types";

/** Source tag for opt-ins made on ypnus.com/sms-opt-in. */
export const LO_SMS_OPT_IN_SOURCE = "lo_sms_opt_in_page";

/** The newest ledger entry for a 10-digit number, if any. */
export function latestSmsOptIn(db: Pick<DbShape, "smsOptIns">, phone: string): SmsOptInRecord | undefined {
  let latest: SmsOptInRecord | undefined;
  for (const record of db.smsOptIns) {
    if (record.phone !== phone) continue;
    if (!latest || record.at >= latest.at) latest = record;
  }
  return latest;
}

/** True when the newest entry for this number is an opt-in (a later STOP turns it off). */
export function hasLoanOfficerSmsOptIn(db: Pick<DbShape, "smsOptIns">, phone: string): boolean {
  return latestSmsOptIn(db, phone)?.granted === true;
}

/** Appends one entry to the loan officer text opt-in ledger and returns it. */
export function recordSmsOptIn(input: Omit<SmsOptInRecord, "id" | "at"> & { at?: string }): SmsOptInRecord {
  const record: SmsOptInRecord = { id: generateId("smsopt"), at: input.at ?? new Date().toISOString(), ...input };
  writeDb((db) => {
    db.smsOptIns.push(record);
  });
  return record;
}

/**
 * A STOP or START reply from a number that opted in on the loan officer page: records the
 * change for that number. Numbers that never opted in there are left alone. Returns whether a
 * change was recorded.
 */
export function applyLoanOfficerSmsKeyword(phone: string, action: "stop" | "start"): boolean {
  if (!phone) return false;
  const latest = latestSmsOptIn(readDb(), phone);
  if (!latest) return false;
  const granted = action === "start";
  if (latest.granted === granted) return false;
  recordSmsOptIn({ phone, granted, source: action === "stop" ? "sms_stop" : "sms_start" });
  return true;
}
