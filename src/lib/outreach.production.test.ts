import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { BorrowerLeadRecord, ScheduledFollowUpRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-outreach-prod-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
for (const key of [
  "TWILIO_ACCOUNT_SID",
  "SENDGRID_API_KEY",
  "RESEND_API_KEY",
  "OUTREACH_WEBHOOK_URL",
  "COUNTY_LOOKUP_API_URL",
  "CENSUS_API_BASE",
  "RENTAL_DEMAND_API_URL",
  "COUNTY_EVENTS_API_URL",
]) {
  delete process.env[key];
}
const env = process.env as Record<string, string | undefined>;
const originalNodeEnv = env.NODE_ENV;

const lead: BorrowerLeadRecord = {
  id: "lead_prod_1",
  createdAt: new Date().toISOString(),
  funnelSource: "unit_test",
  assignedLoId: "lo_jordan_lee",
  crmLeadId: "crm_test",
  answers: {
    loanProgram: "FHA",
    name: "Taylor Borrower",
    email: "taylor@example.com",
    phone: "+15555550123",
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
};

const followUp: ScheduledFollowUpRecord = {
  id: "fu_prod_1",
  borrowerLeadId: lead.id,
  plan: "day_1_educational_email",
  channel: "email",
  recipient: "taylor@example.com",
  scheduledAt: new Date(Date.now() - 60_000).toISOString(),
  status: "pending",
  bodySummary: "Education drip.",
  createdAt: new Date().toISOString(),
};

describe("outreach in production with no provider configured", async () => {
  const { processDueFollowUps } = await import("./automation");
  const { appendBorrowerLead, persistFollowUpsBatch, readDb, writeDb } = await import("./db");
  const { deliverOutreach, OutreachNotConfiguredError } = await import("./outreach");

  after(() => {
    env.NODE_ENV = originalNodeEnv;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("refuses to report a send that did not happen", async () => {
    env.NODE_ENV = "production";
    const officer = readDb().loanOfficers.find((item) => item.id === "lo_jordan_lee");
    assert.ok(officer);
    await assert.rejects(
      () => deliverOutreach(followUp, { lead, officer }),
      (error: unknown) => error instanceof OutreachNotConfiguredError,
    );
  });

  it("keeps the follow-up pending (and the attempt count unspent) instead of marking it sent", async () => {
    env.NODE_ENV = "production";
    writeDb((db) => {
      const officer = db.loanOfficers.find((item) => item.id === "lo_jordan_lee");
      assert.ok(officer);
      officer.entitlementTier = "growth";
      officer.entitlementStatus = "active";
    });
    appendBorrowerLead(lead);
    persistFollowUpsBatch([followUp]);

    const summary = await processDueFollowUps({ borrowerLeadId: lead.id });
    assert.equal(summary.processed, 0);

    const stored = readDb().followUps.find((item) => item.id === followUp.id);
    assert.ok(stored);
    assert.equal(stored.status, "pending");
    assert.equal(stored.attemptCount ?? 0, 0);
    assert.ok(new Date(stored.scheduledAt).getTime() > Date.now(), "retry is scheduled in the future");
    assert.match(stored.lastError ?? "", /No email outreach provider/);
  });

  it("still uses the demo provider outside production", async () => {
    env.NODE_ENV = "test";
    const officer = readDb().loanOfficers.find((item) => item.id === "lo_jordan_lee");
    assert.ok(officer);
    const result = await deliverOutreach(followUp, { lead, officer });
    assert.equal(result.provider, "demo");
  });
});
