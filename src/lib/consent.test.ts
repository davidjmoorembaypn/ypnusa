import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canContact, isQuietHours, isStopKeyword, latestConsent, nextAllowedContactTime } from "./consent";
import type { ConsentRecord } from "./types";

// 2026-11-16 is in standard time: Pacific = UTC-8, Eastern = UTC-5.
const NOON_PACIFIC = new Date("2026-11-16T20:00:00Z");
const TEN_PM_PACIFIC = new Date("2026-11-17T06:00:00Z");
const SEVEN_AM_PACIFIC = new Date("2026-11-16T15:00:00Z"); // 10am Eastern

function consent(channel: ConsentRecord["channel"], granted: boolean, at: string, source = "test"): ConsentRecord {
  return { id: `c_${channel}_${at}`, borrowerLeadId: "lead_1", channel, granted, source, at };
}

describe("quiet hours", () => {
  it("allows 8am to 9pm in the borrower's zone", () => {
    assert.equal(isQuietHours(NOON_PACIFIC, "America/Los_Angeles"), false);
    assert.equal(isQuietHours(TEN_PM_PACIFIC, "America/Los_Angeles"), true);
    assert.equal(isQuietHours(SEVEN_AM_PACIFIC, "America/Los_Angeles"), true);
    assert.equal(isQuietHours(SEVEN_AM_PACIFIC, "America/New_York"), false);
  });

  it("with an unknown zone, requires both Eastern and Pacific to be inside the window", () => {
    assert.equal(isQuietHours(NOON_PACIFIC), false);
    assert.equal(isQuietHours(SEVEN_AM_PACIFIC), true);
  });

  it("finds the next allowed time", () => {
    const next = nextAllowedContactTime(TEN_PM_PACIFIC, "America/Los_Angeles");
    assert.equal(next.toISOString(), "2026-11-17T16:00:00.000Z"); // 8am Pacific
    assert.equal(nextAllowedContactTime(NOON_PACIFIC).toISOString(), NOON_PACIFIC.toISOString());
  });
});

describe("canContact", () => {
  it("uses the intake form's consent when the ledger is empty", () => {
    const db = { consents: [] };
    assert.deepEqual(canContact({ db, borrowerLeadId: "lead_1", channel: "email", legacyConsent: true, now: NOON_PACIFIC }), { allowed: true });
    assert.deepEqual(canContact({ db, borrowerLeadId: "lead_1", channel: "email", legacyConsent: false, now: NOON_PACIFIC }), {
      allowed: false,
      reason: "no_consent",
    });
  });

  it("texts only borrowers who opted in on ypnus.com (the carrier-registered opt-in)", () => {
    const at = "2026-11-01T00:00:00Z";
    const text = (consents: ConsentRecord[], legacyConsent = true) =>
      canContact({ db: { consents }, borrowerLeadId: "lead_1", channel: "sms", legacyConsent, now: NOON_PACIFIC }).allowed;
    assert.equal(text([]), false, "a bare legacy yes is not a text opt-in");
    assert.equal(text([consent("sms", true, at, "lead_webhook:partner")]), false, "a partner's lead is never texted");
    assert.equal(text([consent("sms", true, at, "officer_marked")]), false);
    assert.equal(text([consent("sms", true, at, "intake_form")]), true);
    assert.equal(text([consent("sms", true, at, "chat_assistant:sess_1")]), true);
    assert.equal(text([consent("sms", true, at, "sms_start")]), true);
    assert.equal(text([consent("sms", true, at, "intake_formX")]), false);
  });

  it("an opt-out always wins, even over the original form consent", () => {
    const db = { consents: [consent("sms", true, "2026-11-01T00:00:00Z"), consent("sms", false, "2026-11-10T00:00:00Z")] };
    assert.deepEqual(canContact({ db, borrowerLeadId: "lead_1", channel: "sms", legacyConsent: true, now: NOON_PACIFIC }), {
      allowed: false,
      reason: "opted_out",
    });
    assert.equal(latestConsent(db, "lead_1", "sms")?.granted, false);
  });

  it("AI voice calls need their own ledger grant", () => {
    assert.equal(canContact({ db: { consents: [] }, borrowerLeadId: "lead_1", channel: "ai_voice", legacyConsent: true, now: NOON_PACIFIC }).allowed, false);
    const db = { consents: [consent("ai_voice", true, "2026-11-01T00:00:00Z")] };
    assert.equal(canContact({ db, borrowerLeadId: "lead_1", channel: "ai_voice", now: NOON_PACIFIC }).allowed, true);
  });

  it("holds texts during quiet hours with a retry time, but not email", () => {
    const db = { consents: [consent("sms", true, "2026-11-01T00:00:00Z", "intake_form")] };
    const text = canContact({ db, borrowerLeadId: "lead_1", channel: "sms", legacyConsent: true, now: TEN_PM_PACIFIC, timeZone: "America/Los_Angeles" });
    assert.deepEqual(text, { allowed: false, reason: "quiet_hours", retryAt: "2026-11-17T16:00:00.000Z" });
    assert.deepEqual(canContact({ db, borrowerLeadId: "lead_1", channel: "email", legacyConsent: true, now: TEN_PM_PACIFIC }), { allowed: true });
  });
});

describe("STOP keywords", () => {
  it("recognizes opt-out replies", () => {
    for (const word of ["STOP", " stop ", "Unsubscribe", "cancel", "END", "quit", "Revoke", "opt out", "STOPALL"]) {
      assert.equal(isStopKeyword(word), true, word);
    }
    assert.equal(isStopKeyword("please don't stop helping me"), false);
    assert.equal(isStopKeyword("yes"), false);
  });
});
