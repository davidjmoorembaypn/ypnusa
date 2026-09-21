import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { BorrowerLeadRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-nurture-access-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("MLO borrower isolation", async () => {
  const { writeDb } = await import("./db");
  const { buildNurtureDashboardForSession } = await import("./nurture-dashboard");

  before(() => {
    writeDb((db) => {
      db.borrowerLeads = ["lo_jordan_lee", "lo_priya_nandakumar"].map((id): BorrowerLeadRecord => ({
        id: `lead_${id}`, assignedLoId: id, crmLeadId: `crm_${id}`, createdAt: new Date().toISOString(),
        answers: { loanProgram: "FHA", name: `Borrower ${id}` },
        qualification: { programScores: { overallScore: 70 }, leadQuality: "strong", urgency: "high", rationale: [], recommendedNextStep: "Review" },
      }));
      db.propertyEvaluations = [{
        id: "unassigned_equity", createdAt: new Date().toISOString(), name: "Private Borrower",
        email: "sample@example.com", zip: "92672", estimatedHomeValueUsd: 500000,
        currentMortgageBalanceUsd: 300000, estimatedEquityUsd: 200000,
        illustrativeCashOutUsd: 100000, estimatedLtvPct: 60, contactConsent: true,
        source: "test", status: "new",
      }];
    });
  });

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("shows only the signed officer's assigned borrowers and connections", () => {
    const result = buildNurtureDashboardForSession({ sub: "lo_jordan_lee", role: "mlo" });
    assert.deepEqual(result.rows.map((row) => row.leadId), ["lead_lo_jordan_lee"]);
    assert.deepEqual(result.calendarConnections.map((row) => row.officerId), ["lo_jordan_lee"]);
    assert.deepEqual(result.equityReviews, []);
    assert.equal(result.totals.activeConversations, 1);
  });

  it("fails closed for unlinked or empty subjects", () => {
    for (const sub of ["wp_unlinked", ""]) {
      const result = buildNurtureDashboardForSession({ sub, role: "mlo" });
      assert.deepEqual(result.rows, []);
      assert.deepEqual(result.calendarConnections, []);
      assert.deepEqual(result.equityReviews, []);
      assert.equal(result.totals.activeConversations, 0);
    }
  });

  it("keeps the aggregate ledger and unassigned equity queue available to admins", () => {
    const result = buildNurtureDashboardForSession({ sub: "admin", role: "admin" });
    assert.equal(result.rows.length, 2);
    assert.equal(result.equityReviews.length, 1);
  });
});
