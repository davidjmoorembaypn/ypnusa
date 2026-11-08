import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { BorrowerAnswers, LoanOfficerRecord, QualificationSummary, RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-crm-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const officers: LoanOfficerRecord[] = [
  { id: "lo_fha_a", name: "FHA A", email: "fha-a@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_fha_b", name: "FHA B", email: "fha-b@example.com", specialties: ["FHA"], weeklyWindows: [] },
  { id: "lo_jumbo", name: "Jumbo", email: "jumbo@example.com", specialties: ["JUMBO"], weeklyWindows: [] },
];

const answers: BorrowerAnswers = {
  loanProgram: "FHA",
  name: "Taylor Borrower",
  email: "taylor@example.com",
  phone: "+15555550123",
  timeline: "1_3_months",
  estimatedCreditBand: "670-739",
};

const qualification: QualificationSummary = {
  programScores: { overallScore: 81.4 },
  leadQuality: "strong",
  urgency: "high",
  recommendedNextStep: "Fast LOS build.",
  rationale: ["one", "two", "three", "four", "five"],
};

describe("crm routing and activity log", async () => {
  const { readDb, writeDb } = await import("./db");
  const { borrowerFacingOfficer, HOUSE_OFFICER_ID, isDemoOfficer, logCrmActivity, routeLead, routeLoanOfficer } =
    await import("./crm");
  const { findAccountByEmail } = await import("./accounts");
  const { buildNurtureDashboard } = await import("./nurture-dashboard");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeDb((db) => {
      db.loanOfficers = officers.map((officer) => ({ ...officer }));
      db.revenueSubscriptions = [];
      db.borrowerLeads = [];
      db.crmLeads = [];
    });
  });

  function paidSub(overrides: Partial<RevenueSubscriptionRecord>): RevenueSubscriptionRecord {
    const now = new Date().toISOString();
    return {
      id: `sub_${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      startedAt: now,
      tier: "growth",
      status: "active",
      source: "stripe_webhook",
      claimedZips: ["93720"],
      ...overrides,
    };
  }

  it("sends a lead with no ZIP code to the house account, never to a roster or demo officer", () => {
    const route = routeLead({ program: "JUMBO" });
    assert.equal(route.reason, "house");
    assert.equal(route.officer.id, HOUSE_OFFICER_ID);
    assert.equal(route.officer.name, "David J. Moore");
    assert.equal(route.officer.email, "support@ypnus.com");
    assert.ok(readDb().loanOfficers.some((officer) => officer.id === HOUSE_OFFICER_ID), "house officer is stored");
    assert.equal(routeLoanOfficer("FHA").id, HOUSE_OFFICER_ID);
  });

  it("routes a lead in a paid subscriber's ZIP code to that subscriber's account", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub({ ownerEmail: "Real.MLO@example.com", status: "trialing" })];
    });
    const route = routeLead({ program: "FHA", zip: "93720-1234" });
    const account = findAccountByEmail("real.mlo@example.com");
    assert.ok(account, "an account exists for the paying MLO");
    assert.equal(route.reason, "zip_owner");
    assert.equal(route.officer.id, account.id, "officer id is the account id (the session sub)");
    assert.equal(route.officer.email, "real.mlo@example.com");
    assert.equal(route.officer.entitlementTier, "growth");

    // The MLO sees the lead on their own dashboard.
    const crm = logCrmActivity({ ...answers, zip: "93720" }, qualification, route.officer.id);
    const dashboard = buildNurtureDashboard(account.id);
    assert.ok(dashboard.rows.some((row) => row.leadId === crm.borrowerLeadId));
  });

  it("ignores seeded demo, cancelled and demo-request claims and falls back to the house account", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        paidSub({ source: "seed", ownerLoId: "lo_jordan_lee", ownerEmail: "jordan.lee@loanapilot.ai" }),
        paidSub({ status: "cancelled", ownerEmail: "gone@example.com" }),
        paidSub({ source: "demo_request", ownerEmail: "demo@example.com" }),
      ];
    });
    assert.equal(routeLead({ program: "FHA", zip: "93720" }).reason, "house");
  });

  it("never routes to a demo officer even when a paid record points at one", () => {
    writeDb((db) => {
      db.loanOfficers = [
        ...officers,
        { id: "lo_jordan_lee", name: "Jordan Lee", email: "jordan.lee@loanapilot.ai", specialties: ["FHA"], weeklyWindows: [] },
      ];
      db.revenueSubscriptions = [paidSub({ ownerLoId: "lo_jordan_lee", ownerEmail: "owner2@example.com" })];
    });
    const route = routeLead({ program: "FHA", zip: "93720" });
    assert.equal(route.reason, "zip_owner");
    assert.notEqual(route.officer.id, "lo_jordan_lee");
    assert.equal(route.officer.email, "owner2@example.com");
  });

  it("hides demo officer names from borrowers in production", () => {
    const demo: LoanOfficerRecord = {
      id: "lo_mateo_rosales",
      name: "Mateo Rosales",
      email: "mateo.r@loanapilot.ai",
      specialties: ["FHA"],
      weeklyWindows: [],
    };
    assert.equal(isDemoOfficer(demo), true);
    assert.equal(isDemoOfficer(officers[0]), false);
    const env = process.env as Record<string, string | undefined>;
    const saved = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      assert.equal(borrowerFacingOfficer(demo).name, "David J. Moore");
      assert.equal(borrowerFacingOfficer(officers[0]).name, "FHA A");
    } finally {
      env.NODE_ENV = saved;
    }
  });

  it("persists a linked borrower lead and CRM record with mirrored notes", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a", "paid_search", "sess_123");
    const db = readDb();
    const lead = db.borrowerLeads.find((entry) => entry.id === result.borrowerLeadId);
    const crm = db.crmLeads.find((entry) => entry.id === result.crmLeadId);

    assert.match(result.borrowerLeadId, /^lead_/);
    assert.match(result.crmLeadId, /^crm_/);
    assert.equal(lead?.crmLeadId, result.crmLeadId);
    assert.equal(lead?.sessionId, "sess_123");
    assert.equal(lead?.funnelSource, "paid_search");
    assert.equal(lead?.assignedLoId, "lo_fha_a");
    assert.equal(crm?.borrowerLeadId, result.borrowerLeadId);
    assert.equal(crm?.status, "new_ai_routed");
    assert.deepEqual(crm?.qualificationSnapshot, qualification);
    assert.deepEqual(result.notes.slice(0, 4), [
      "Funnel cohort: paid_search",
      "LOS composite 81 / quality strong",
      "AI coaching: Fast LOS build.",
      "Session lineage: sess_123",
    ]);
    assert.equal(result.notes.length, 8, "at most four model notes are mirrored");
    assert.ok(result.notes.every((note) => typeof note === "string" && note.length > 0));
  });

  it("labels an anonymous funnel and falls back to the lead id for session lineage", () => {
    const result = logCrmActivity(answers, qualification, "lo_fha_a");

    assert.equal(result.notes[0], "Funnel cohort: unspecified_ai_channel");
    assert.equal(result.notes[3], `Session lineage: ${result.borrowerLeadId}`);
  });
});
