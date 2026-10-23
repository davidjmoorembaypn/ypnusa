import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { BorrowerLeadRecord } from "../types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-growth-plan-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const DAY = 24 * 60 * 60 * 1000;

function lead(id: string, loId: string, ageDays: number, now: number): BorrowerLeadRecord {
  return {
    id,
    createdAt: new Date(now - ageDays * DAY).toISOString(),
    funnelSource: "test",
    assignedLoId: loId,
    crmLeadId: `crm_${id}`,
    answers: {
      loanProgram: "FHA",
      name: "Pat Borrower",
      email: "pat@example.com",
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
}

describe("loadGrowthPlanInput", async () => {
  const { appendBorrowerLead, saveRevenueSubscription } = await import("../db");
  const { loadGrowthPlanInput } = await import("./weekly-plan");
  const now = Date.now();

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("counts only this officer's leads, by week, and only active zip claims", () => {
    appendBorrowerLead(lead("a1", "lo_jordan_lee", 1, now));
    appendBorrowerLead(lead("a2", "lo_jordan_lee", 3, now));
    appendBorrowerLead(lead("a3", "lo_jordan_lee", 10, now));
    appendBorrowerLead(lead("b1", "lo_someone_else", 1, now));
    saveRevenueSubscription({
      id: "rev_1",
      createdAt: new Date(now).toISOString(),
      startedAt: new Date(now).toISOString(),
      tier: "growth",
      status: "active",
      source: "stripe_webhook",
      ownerLoId: "lo_jordan_lee",
      claimedZips: ["93711"],
    });
    saveRevenueSubscription({
      id: "rev_2",
      createdAt: new Date(now).toISOString(),
      startedAt: new Date(now).toISOString(),
      tier: "growth",
      status: "cancelled",
      source: "stripe_webhook",
      ownerLoId: "lo_jordan_lee",
      claimedZips: ["90210"],
    });

    const input = loadGrowthPlanInput(
      { sub: "lo_jordan_lee", role: "mlo", tier: "growth", subscriptionStatus: "active" },
      now,
    );
    assert.equal(input.leadsLast7Days, 2);
    assert.equal(input.leadsPrevious7Days, 1);
    assert.equal(input.leadsEver, 3);
    assert.equal(input.claimedZips, 1);
    assert.equal(input.paidPlan, true);
  });

  it("treats a session with no paid claim as a free plan", () => {
    const input = loadGrowthPlanInput({ sub: "lo_jordan_lee", role: "mlo" }, now);
    assert.equal(input.paidPlan, false);
  });
});
