import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { BorrowerLeadRecord, ScheduledFollowUpRecord } from "./types";

/**
 * The consent gaps found in the PR 216 review: a STOP or booking that lands while a follow-up is
 * being prepared, a STOP whose processing stopped part way, and journey messages from an officer
 * who has not listed a license in the borrower's state.
 */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-consent-gaps-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.SENDGRID_API_KEY;
delete process.env.CENSUS_API_BASE;
delete process.env.RENTAL_DEMAND_API_URL;
delete process.env.COUNTY_EVENTS_API_URL;

const PHONE = "+15595550147";

function buildLead(overrides: Partial<BorrowerLeadRecord> = {}): BorrowerLeadRecord {
  return {
    id: `lead_${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    funnelSource: "unit_test",
    assignedLoId: "lo_jordan_lee",
    crmLeadId: "crm_test",
    answers: {
      loanProgram: "FHA",
      name: "Taylor Borrower",
      email: "taylor@example.com",
      phone: PHONE,
      zip: "93618",
      timeline: "1_3_months",
      estimatedCreditBand: "670-739",
      contactConsent: true,
    },
    qualification: {
      leadQuality: "strong",
      urgency: "high",
      programScores: { overallScore: 70 },
      recommendedNextStep: "Route to an MLO",
      rationale: [],
    },
    ...overrides,
  };
}

function buildFollowUp(borrowerLeadId: string, overrides: Partial<ScheduledFollowUpRecord> = {}): ScheduledFollowUpRecord {
  return {
    id: `fu_${Math.random().toString(36).slice(2, 10)}`,
    borrowerLeadId,
    plan: "day_1_educational_email",
    channel: "email",
    recipient: "taylor@example.com",
    scheduledAt: new Date(Date.now() - 60_000).toISOString(),
    status: "pending",
    bodySummary: "Education drip.",
    createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    ...overrides,
  };
}

describe("consent gaps from the PR 216 review", async () => {
  // A stand-in for the rental-demand lookup that personalization awaits (the only network call left in it). Whatever is queued in
  // `duringLookup` runs while the worker is waiting on it, like a STOP arriving mid-send.
  let duringLookup: (() => void) | undefined;
  const lookup = http.createServer((_req, res) => {
    duringLookup?.();
    duringLookup = undefined;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ county: "Tulare" }));
  });
  await new Promise<void>((resolve) => lookup.listen(0, "127.0.0.1", resolve));
  process.env.RENTAL_DEMAND_API_URL = `http://127.0.0.1:${(lookup.address() as AddressInfo).port}/county`;

  let delivered: string[] = [];
  const outreach = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      delivered.push(JSON.parse(raw).recipient);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: "msg_1" }));
    });
  });
  await new Promise<void>((resolve) => outreach.listen(0, "127.0.0.1", resolve));
  process.env.OUTREACH_WEBHOOK_URL = `http://127.0.0.1:${(outreach.address() as AddressInfo).port}/send`;

  const { processDueFollowUps } = await import("./automation");
  const { appendBorrowerLead, persistFollowUpsBatch, readDb, writeDb } = await import("./db");
  const { recordOptOutAllChannels, latestConsent } = await import("./consent");
  const { handleInboundSms } = await import("./sms-inbound");
  const { claimKey } = await import("./idempotency");

  const jobStatus = (id: string) => readDb().followUps.find((job) => job.id === id)?.status;

  before(() => {
    writeDb((db) => {
      const officer = db.loanOfficers.find((item) => item.id === "lo_jordan_lee");
      assert.ok(officer);
      officer.entitlementTier = "growth";
      officer.entitlementStatus = "active";
      officer.nmlsId = "123456";
      officer.licenses = [{ state: "CA", type: "ca_dre", number: "01234567" }];
    });
    delivered = [];
  });

  after(async () => {
    delete process.env.OUTREACH_WEBHOOK_URL;
    delete process.env.RENTAL_DEMAND_API_URL;
    await new Promise<void>((resolve) => lookup.close(() => resolve()));
    await new Promise<void>((resolve) => outreach.close(() => resolve()));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("sends a due email when nothing changes while it is prepared", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const job = buildFollowUp(lead.id);
    persistFollowUpsBatch([job]);
    delivered = [];

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 1);
    assert.equal(jobStatus(job.id), "sent");
    assert.equal(delivered.length, 1);
  });

  it("does not send a follow-up when STOP arrives while it is being prepared", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const job = buildFollowUp(lead.id);
    persistFollowUpsBatch([job]);
    delivered = [];
    duringLookup = () => recordOptOutAllChannels(lead.id, "sms_stop");

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 0);
    assert.equal(delivered.length, 0);
    assert.equal(jobStatus(job.id), "cancelled");
  });

  it("does not send a booking nudge to a borrower who booked after it was queued", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const job = buildFollowUp(lead.id, { plan: "day_3_book_call_email" });
    persistFollowUpsBatch([job]);
    // A call booked before the booking code cancelled pending jobs: the job is still pending.
    writeDb((db) => {
      db.appointments.push({
        id: `appt_${lead.id}`,
        borrowerLeadId: lead.id,
        loId: "lo_jordan_lee",
        start: new Date(Date.now() + 86_400_000).toISOString(),
        end: new Date(Date.now() + 86_400_000 + 1_800_000).toISOString(),
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        status: "booked",
      });
    });
    delivered = [];

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 0);
    assert.equal(delivered.length, 0);
    assert.equal(jobStatus(job.id), "cancelled");
  });

  it("still sends when the borrower's only call was cancelled", async () => {
    const lead = buildLead();
    appendBorrowerLead(lead);
    const job = buildFollowUp(lead.id, { plan: "day_3_book_call_email" });
    persistFollowUpsBatch([job]);
    writeDb((db) => {
      db.appointments.push({
        id: `appt_${lead.id}`,
        borrowerLeadId: lead.id,
        loId: "lo_jordan_lee",
        start: new Date(Date.now() + 86_400_000).toISOString(),
        end: new Date(Date.now() + 86_400_000 + 1_800_000).toISOString(),
        createdAt: new Date(Date.now() - 86_400_000).toISOString(),
        status: "cancelled",
      });
    });
    delivered = [];

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });

    assert.equal(summary.processed, 1);
    assert.equal(jobStatus(job.id), "sent");
  });

  it("finishes a STOP that stopped part way when Twilio redelivers it", () => {
    const phone = "+15595550199";
    const first = buildLead({ answers: { ...buildLead().answers, phone } });
    const second = buildLead({ answers: { ...buildLead().answers, phone } });
    appendBorrowerLead(first);
    appendBorrowerLead(second);
    // The first delivery opted out one lead, then the server stopped before the second.
    recordOptOutAllChannels(first.id, "sms_stop");
    const before = readDb().consents.length;

    const result = handleInboundSms({ from: phone, body: "STOP", messageSid: "SM_partial" });

    assert.equal(result.action, "opted_out");
    const db = readDb();
    for (const channel of ["sms", "call", "email", "ai_voice"] as const) {
      assert.equal(latestConsent(db, second.id, channel)?.granted, false);
    }
    // The lead that was already opted out gets no second set of entries.
    assert.equal(db.consents.length, before + 4);
  });

  it("treats a redelivered STOP as a duplicate once it was fully processed", () => {
    const phone = "+15595550177";
    const lead = buildLead({ answers: { ...buildLead().answers, phone } });
    appendBorrowerLead(lead);

    assert.equal(handleInboundSms({ from: phone, body: "STOP", messageSid: "SM_full" }).action, "opted_out");
    // The borrower opts back in; an old STOP redelivered after that must not undo it.
    assert.equal(handleInboundSms({ from: phone, body: "START", messageSid: "SM_start" }).action, "opted_in");
    assert.equal(handleInboundSms({ from: phone, body: "STOP", messageSid: "SM_full" }).action, "duplicate");
    assert.equal(latestConsent(readDb(), lead.id, "sms")?.granted, true);
    // The claim exists, so a later claim attempt for the same ID is refused.
    assert.equal(claimKey("sms_inbound", "SM_full").claimed, false);
  });

  it("blocks journey emails from an officer with no license listed in the borrower's state", async () => {
    writeDb((db) => {
      const officer = db.loanOfficers.find((item) => item.id === "lo_jordan_lee");
      assert.ok(officer);
      officer.licenses = [];
    });
    try {
      const lead = buildLead();
      appendBorrowerLead(lead);
      const drip = buildFollowUp(lead.id);
      const reply = buildFollowUp(lead.id, { plan: "immediate_confirmation_email", createdAt: new Date().toISOString() });
      persistFollowUpsBatch([drip, reply]);
      delivered = [];

      await processDueFollowUps({ borrowerLeadId: lead.id });

      const db = readDb();
      const blocked = db.followUps.find((job) => job.id === drip.id);
      assert.equal(blocked?.status, "cancelled");
      assert.match(blocked?.lastError ?? "", /haven't listed a license in CA/);
      // The instant "we got your request" reply still answers the borrower.
      assert.equal(db.followUps.find((job) => job.id === reply.id)?.status, "sent");
      assert.equal(delivered.length, 1);
    } finally {
      writeDb((db) => {
        const officer = db.loanOfficers.find((item) => item.id === "lo_jordan_lee");
        if (officer) officer.licenses = [{ state: "CA", type: "ca_dre", number: "01234567" }];
      });
    }
  });
});
