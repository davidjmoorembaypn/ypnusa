import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-appointments-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import {
  buildIcs,
  cancelAppointment,
  formatWhen,
  listUpcoming,
  manageToken,
  sendBookingConfirmation,
  sendDueReminders,
  verifyManageToken,
} from "./appointments";
import { bookAppointment, listAvailableSlots } from "./calendar";
import { recordOptOutAllChannels } from "./consent";
import { HOUSE_OFFICER_ID } from "./crm";
import { appendAppointment, appendBorrowerLead, readDb, writeDb } from "./db";
import type { SendEmailInput } from "./email";
import { connectState, officerForViewer, readConnectState } from "./google-calendar";
import { generateId } from "./id";
import type { AppointmentRecord, LoanOfficerRecord } from "./types";

const qualification = { programScores: {}, leadQuality: "strong" as const, urgency: "high" as const, recommendedNextStep: "Call", rationale: [] };

function addOfficer(): LoanOfficerRecord {
  const officer: LoanOfficerRecord = {
    ...readDb().loanOfficers[0],
    id: generateId("lo"),
    name: "Dana Reyes",
    email: `dana-${Math.random().toString(36).slice(2)}@lender.test`,
    nmlsId: "123456",
    calendarProvider: "local",
    calendarTimeZone: "America/Los_Angeles",
    weeklyWindows: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, startMin: 0, endMin: 1440 })),
  };
  writeDb((db) => {
    db.loanOfficers.push(officer);
  });
  return officer;
}

function addLead(loId: string, email = "sam@borrowermail.com"): string {
  const id = generateId("lead");
  appendBorrowerLead({
    id,
    createdAt: new Date().toISOString(),
    assignedLoId: loId,
    qualification,
    crmLeadId: "",
    answers: { loanProgram: "CONVENTIONAL", name: "Sam Buyer", email, contactConsent: true },
  });
  return id;
}

function recorder() {
  const sent: SendEmailInput[] = [];
  const send = async (input: SendEmailInput) => {
    sent.push(input);
    return { sent: true };
  };
  return { sent, send };
}

function storedAppointment(start: Date, loId: string, borrowerLeadId: string, extra: Partial<AppointmentRecord> = {}): AppointmentRecord {
  const record: AppointmentRecord = {
    id: generateId("appt"),
    borrowerLeadId,
    loId,
    start: start.toISOString(),
    end: new Date(start.getTime() + 30 * 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    provider: "local",
    status: "booked",
    timeZone: "America/Los_Angeles",
    ...extra,
  };
  appendAppointment(record);
  return record;
}

describe("appointments", () => {
  it("formats times in the officer's zone", () => {
    assert.equal(formatWhen("2026-11-20T18:30:00Z", "America/Los_Angeles"), "Friday, November 20 at 10:30 AM PST");
  });

  it("books an open slot once, refuses a second booking, and frees the slot when cancelled", async () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    const slot = listAvailableSlots(officer.id, 3)[0];
    const appointment = await bookAppointment({ borrowerLeadId: lead, loId: officer.id, startIso: slot.start });
    assert.equal(appointment.status, "booked");
    assert.equal(appointment.timeZone, "America/Los_Angeles");
    assert.ok(!listAvailableSlots(officer.id, 3).some((item) => item.start === slot.start));
    await assert.rejects(bookAppointment({ borrowerLeadId: lead, loId: officer.id, startIso: listAvailableSlots(officer.id, 3)[0].start }), /already has an appointment/);
    const { send } = recorder();
    assert.equal((await cancelAppointment(appointment.id, "borrower", new Date(), send)).ok, true);
    assert.ok(listAvailableSlots(officer.id, 3).some((item) => item.start === slot.start));
    assert.deepEqual(await cancelAppointment(appointment.id, "borrower", new Date(), send), { ok: false, error: "already_cancelled" });
  });

  it("books the house account even before it was saved as an officer", async () => {
    const lead = addLead(HOUSE_OFFICER_ID);
    writeDb((db) => {
      const house = db.loanOfficers.find((item) => item.id === HOUSE_OFFICER_ID);
      if (house) db.loanOfficers.splice(db.loanOfficers.indexOf(house), 1);
    });
    const { ensureHouseOfficer } = await import("./crm");
    ensureHouseOfficer();
    const first = listAvailableSlots(HOUSE_OFFICER_ID, 8)[0];
    assert.ok(first, "the house account has open hours");
    const appointment = await bookAppointment({ borrowerLeadId: lead, loId: HOUSE_OFFICER_ID, startIso: first.start });
    assert.equal(appointment.loId, HOUSE_OFFICER_ID);
  });

  it("emails the borrower and officer a confirmation with a calendar invite, once", async () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    const appointment = storedAppointment(new Date(Date.now() + 3 * 86400_000), officer.id, lead, { meetingUrl: "https://meet.example/abc" });
    const { sent, send } = recorder();
    await sendBookingConfirmation(appointment.id, new Date(), send);
    assert.equal(sent.length, 2);
    const [borrower, officerMail] = sent;
    assert.equal(borrower.to, "sam@borrowermail.com");
    assert.equal(borrower.replyTo, officer.email);
    assert.match(borrower.html, /appointment\?a=/);
    assert.match(borrower.html, /NMLS #123456/);
    assert.match(borrower.attachments?.[0].content ?? "", /METHOD:REQUEST[\s\S]*DTSTART/);
    assert.equal(officerMail.to, officer.email);
    await sendBookingConfirmation(appointment.id, new Date(), send);
    assert.equal(sent.length, 2);
  });

  it("never emails a borrower who opted out, but still tells the officer", async () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    recordOptOutAllChannels(lead, "test");
    const appointment = storedAppointment(new Date(Date.now() + 3 * 86400_000), officer.id, lead);
    const { sent, send } = recorder();
    await sendBookingConfirmation(appointment.id, new Date(), send);
    assert.deepEqual(sent.map((mail) => mail.to), [officer.email]);
  });

  it("sends one reminder the day before", async () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    const now = new Date();
    const tomorrow = storedAppointment(new Date(now.getTime() + 24 * 3600_000), officer.id, lead);
    storedAppointment(new Date(now.getTime() + 4 * 86400_000), officer.id, addLead(officer.id));
    const { sent, send } = recorder();
    await sendDueReminders(now, send);
    const mine = sent.filter((mail) => mail.replyTo === officer.email);
    assert.equal(mine.length, 1);
    assert.match(mine[0].subject, /Reminder/);
    await sendDueReminders(now, send);
    assert.equal(sent.filter((mail) => mail.replyTo === officer.email).length, 1);
    assert.ok(readDb().appointments.find((item) => item.id === tomorrow.id)?.reminderSentAt);
  });

  it("only lets the officer (or an admin) see their appointments", () => {
    const a = addOfficer();
    const b = addOfficer();
    storedAppointment(new Date(Date.now() + 2 * 86400_000), a.id, addLead(a.id));
    assert.ok(listUpcoming({ sub: a.id, role: "officer" }).length >= 1);
    assert.equal(listUpcoming({ sub: b.id, role: "officer" }).length, 0);
  });

  it("signed links: manage token and Google state", () => {
    assert.equal(verifyManageToken("appt_1", manageToken("appt_1")), true);
    assert.equal(verifyManageToken("appt_2", manageToken("appt_1")), false);
    assert.equal(readConnectState(connectState("lo_x")), "lo_x");
    assert.equal(readConnectState(connectState("lo_x", Date.now() - 60 * 60_000)), null);
    assert.equal(readConnectState("lo_y.123.forged"), null);
  });

  it("an admin connects the house account's calendar", () => {
    assert.equal(officerForViewer({ sub: "u_admin", email: "boss@ypn.test", role: "admin" })?.id, HOUSE_OFFICER_ID);
    assert.equal(officerForViewer({ sub: "u_nobody", email: "nobody@ypn.test", role: "officer" }), undefined);
  });

  it("builds a cancel invite", () => {
    const officer = addOfficer();
    const leadId = addLead(officer.id);
    const lead = readDb().borrowerLeads.find((item) => item.id === leadId)!;
    const ics = buildIcs(storedAppointment(new Date(Date.now() + 86400_000), officer.id, leadId), officer, lead, true);
    assert.match(ics, /METHOD:CANCEL/);
    assert.match(ics, /STATUS:CANCELLED/);
  });
});
