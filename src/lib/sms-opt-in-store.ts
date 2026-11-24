import { readDb, writeDb, writeDbDurably } from "./db";
import { generateId } from "./id";
import type { DbShape, SmsOptInRecord } from "./types";

/** Source tag for opt-ins made on ypnus.com/sms-opt-in. */
export const LO_SMS_OPT_IN_SOURCE = "lo_sms_opt_in_page";
const STOP_SOURCE = "sms_stop";
const START_SOURCE = "sms_start";

export interface SmsOptInState {
  /** True when texts to this number are allowed. */
  optedIn: boolean;
  /** True when the number replied STOP and has not replied START since. */
  stoppedByText: boolean;
}

/**
 * Where a 10-digit number stands, from its ledger entries in time order. A STOP reply can only be
 * undone by a START reply from the same phone: a web form submitted after a STOP is kept on
 * record but does not turn texts back on, because anyone can type someone else's number.
 */
export function smsOptInState(db: Pick<DbShape, "smsOptIns">, phone: string): SmsOptInState {
  const records = db.smsOptIns
    .filter((record) => record.phone === phone)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  let optedIn = false;
  let stoppedByText = false;
  for (const record of records) {
    if (record.source === STOP_SOURCE) {
      optedIn = false;
      stoppedByText = true;
    } else if (record.source === START_SOURCE) {
      optedIn = true;
      stoppedByText = false;
    } else if (!stoppedByText) {
      optedIn = record.granted;
    }
  }
  return { optedIn, stoppedByText };
}

/** True when texts to this number are allowed under the loan officer opt-in. */
export function hasLoanOfficerSmsOptIn(db: Pick<DbShape, "smsOptIns">, phone: string): boolean {
  return smsOptInState(db, phone).optedIn;
}

/**
 * Appends one entry to the loan officer text opt-in ledger and returns it, only once it is on
 * disk. If the data file could not be written, the entry is taken back out of memory and the
 * error is thrown, so nobody is told an opt-in or opt-out was saved when it was not.
 */
export function recordSmsOptIn(input: Omit<SmsOptInRecord, "id" | "at"> & { at?: string }): SmsOptInRecord {
  const record: SmsOptInRecord = { id: generateId("smsopt"), at: input.at ?? new Date().toISOString(), ...input };
  try {
    writeDbDurably((db) => {
      db.smsOptIns.push(record);
    });
  } catch (error) {
    try {
      writeDb((db) => {
        db.smsOptIns = db.smsOptIns.filter((entry) => entry.id !== record.id);
      });
    } catch {
      // Best effort: the original error below is what the caller needs.
    }
    throw error;
  }
  return record;
}

/**
 * A STOP or START reply from a number that opted in on the loan officer page: records the
 * change for that number. Numbers with no entry there are left alone. Returns whether a change
 * was recorded. A failed save is logged and never stops the borrower side of the same reply.
 */
export function applyLoanOfficerSmsKeyword(phone: string, action: "stop" | "start"): boolean {
  if (!phone) return false;
  const db = readDb();
  if (!db.smsOptIns.some((record) => record.phone === phone)) return false;
  const state = smsOptInState(db, phone);
  if (action === "stop" ? !state.optedIn && state.stoppedByText : state.optedIn) return false;
  try {
    recordSmsOptIn({ phone, granted: action === "start", source: action === "stop" ? STOP_SOURCE : START_SOURCE });
    return true;
  } catch (error) {
    console.error("[sms-opt-in] could not save a loan officer STOP/START reply", error);
    return false;
  }
}
