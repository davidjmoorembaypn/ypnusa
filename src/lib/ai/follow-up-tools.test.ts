import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateId } from "../id";
import type { BorrowerLeadRecord, ChatSessionRecord } from "../types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-follow-up-tools-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { appendBorrowerLead, appendCrmLead, readDb, writeDb } from "../db";
import { executeMloTool } from "./cerebro-tools";
import {
  executeDraftPrequalLetter,
  executeDraftRateAlerts,
  executeRunFollowUps,
  executeSavePrequalDetails,
  executeSubscribeRateAlerts,
  withDisclosures,
} from "./follow-up-tools";

const qualification = { programScores: {}, leadQuality: "strong" as const, urgency: "high" as const, recommendedNextStep: "Call", rationale: [] };

function addLead(loId: string, answers: Partial<BorrowerLeadRecord["answers"]>, createdAt = new Date(Date.now() - 10 * 86400000).toISOString()) {
  const id = generateId("lead");
  appendBorrowerLead({ id, createdAt, assignedLoId: loId, qualification, crmLeadId: "", answers: { loanProgram: "CONVENTIONAL", ...answers } });
  appendCrmLead({ id: generateId("crm"), createdAt, borrowerLeadId: id, assignedLoId: loId, status: "new_ai_routed", notes: [], qualificationSnapshot: qualification });
  return id;
}

function chat(leadId: string, fields: ChatSessionRecord["capturedFields"]): ChatSessionRecord {
  return {
    id: generateId("chat"),
    mode: "public_site",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    capturedFields: { consent: true, ...fields },
    status: "qualified",
    borrowerLeadId: leadId,
  };
}

const officer = () => readDb().loanOfficers[0];

describe("borrower follow-up tools", () => {
  it("records a rate-alert opt-in and opt-out on the lead", () => {
    const leadId = addLead(officer().id, { name: "Rae Watch", phone: "5595550111", contactConsent: true, purchaseRefiIntent: "refinance" });
    const s = chat(leadId, { name: "Rae Watch", phone: "5595550111" });
    assert.equal(JSON.parse(executeSubscribeRateAlerts({ toolName: "subscribe_rate_alerts", input: { channel: "email" } }, s)).error, "email_missing");
    assert.equal(JSON.parse(executeSubscribeRateAlerts({ toolName: "subscribe_rate_alerts", input: { channel: "text" } }, s)).saved, true);
    assert.equal(readDb().borrowerLeads.find((l) => l.id === leadId)?.rateAlerts?.channel, "text");
  });

  it("refuses without a linked, consenting lead", () => {
    const s = chat("", {});
    s.borrowerLeadId = undefined;
    assert.equal(JSON.parse(executeSavePrequalDetails({ toolName: "save_prequal_details", input: {} }, s)).error, "not_yet_qualified");
  });

  it("saves prequal details, scrubs SSN-like numbers, and queues the request once", () => {
    const leadId = addLead(officer().id, { name: "Pat Buyer", email: "pat@example.com", contactConsent: true, purchaseRefiIntent: "purchase" });
    const s = chat(leadId, { name: "Pat Buyer", email: "pat@example.com" });
    const input = { targetPrice: "around $400k", creditRange: "good", employment: "w2", notes: "my ssn is 123-45-6789", docsReady: ["pay stubs"] };
    executeSavePrequalDetails({ toolName: "save_prequal_details", input }, s);
    executeSavePrequalDetails({ toolName: "save_prequal_details", input }, s);
    const lead = readDb().borrowerLeads.find((l) => l.id === leadId);
    assert.equal(lead?.prequalRequest?.notes, "my ssn is [removed]");
    assert.equal(readDb().cerebroActions.filter((a) => a.borrowerLeadId === leadId && a.kind === "prequal_request").length, 1);
  });
});

describe("officer follow-up tools", () => {
  it("drafts nudges only for consenting, quiet, reachable leads, and never twice", () => {
    const o = officer();
    const quiet = addLead(o.id, { name: "Quiet Buyer", phone: "5595550122", contactConsent: true, purchaseRefiIntent: "purchase" });
    const noConsent = addLead(o.id, { name: "No Consent", phone: "5595550123", contactConsent: false });
    const fresh = addLead(o.id, { name: "Fresh Lead", email: "fresh@example.com", contactConsent: true }, new Date().toISOString());
    const first = JSON.parse(executeRunFollowUps({ toolName: "run_follow_ups", input: { maxLeads: 25 } }, o));
    const nudges = readDb().cerebroActions.filter((a) => a.kind === "nudge_draft");
    assert.ok(nudges.some((a) => a.borrowerLeadId === quiet && /prequalification letter/.test(a.body) && /Reply STOP/.test(a.body)));
    assert.ok(!nudges.some((a) => a.borrowerLeadId === noConsent || a.borrowerLeadId === fresh));
    assert.ok(first.skipped.noConsent >= 1 && first.skipped.recentlyTouched >= 1);
    assert.ok(nudges.every((a) => a.status === "awaiting_approval"));
    const second = JSON.parse(executeRunFollowUps({ toolName: "run_follow_ups", input: { maxLeads: 25 } }, o));
    assert.equal(second.drafted, 0);
    assert.equal(readDb().followUps.length, 0);
  });

  it("drafts rate alerts with no numbers, only for opted-in leads, and rejects a note with a rate", () => {
    const o = officer();
    assert.equal(JSON.parse(executeDraftRateAlerts({ toolName: "draft_rate_alerts", input: { officerNote: "Now 5.9%!" } }, o)).error, "fix_and_retry");
    const out = JSON.parse(executeDraftRateAlerts({ toolName: "draft_rate_alerts", input: { direction: "down" } }, o));
    assert.ok(out.drafted >= 1);
    const alerts = readDb().cerebroActions.filter((a) => a.kind === "rate_alert_draft");
    assert.ok(alerts.every((a) => !/\d\s?%/.test(a.body) && /Rates came down/.test(a.body)));
    assert.equal(JSON.parse(executeDraftRateAlerts({ toolName: "draft_rate_alerts", input: {} }, o)).drafted, 0);
  });

  it("drafts a prequal letter for the officer's own borrower with not-a-commitment language", () => {
    const o = officer();
    const out = JSON.parse(executeDraftPrequalLetter({ toolName: "draft_prequal_letter", input: { borrowerName: "pat buyer", maxPurchasePrice: 425000, loanProgram: "FHA" } }, o));
    assert.equal(out.drafted, true);
    assert.match(out.letter, /\$425,000/);
    assert.match(out.letter, /not a commitment to lend/);
    assert.match(out.letter, /Equal Housing Opportunity/);
    assert.equal(JSON.parse(executeDraftPrequalLetter({ toolName: "draft_prequal_letter", input: { borrowerName: "Nobody", maxPurchasePrice: 400000, loanProgram: "FHA" } }, o)).error, "not_found");
  });

  it("is reachable from the officer's dashboard chat and scoped to their own account", async () => {
    const ok = JSON.parse(await executeMloTool({ toolName: "run_follow_ups", input: {} }, { userEmail: officer().email, paidPlan: true }));
    assert.equal(typeof ok.drafted, "number");
    const stranger = JSON.parse(await executeMloTool({ toolName: "run_follow_ups", input: {} }, { userEmail: "nobody@example.com", paidPlan: true }));
    assert.equal(stranger.error, "no_officer_profile");
  });
});

describe("compliance disclosures on Cerebro drafts", () => {
  it("adds the officer's NMLS ID to a texted nudge, before the STOP line", () => {
    const loId = "lo_compliance_test";
    writeDb((db) => {
      db.loanOfficers.push({ id: loId, name: "Cal Officer", email: "cal@example.com", nmlsId: "555555", specialties: [], weeklyWindows: [] } as never);
    });
    const leadId = addLead(loId, { name: "Nia Nudge", phone: "5595550199", contactConsent: true, zip: "93277" });
    const lead = readDb().borrowerLeads.find((l) => l.id === leadId)!;
    const result = withDisclosures(lead, readDb().loanOfficers.find((o) => o.id === loId)!, "text", "Hi Nia, checking in. Reply STOP to opt out.");
    assert.ok("body" in result);
    if ("body" in result) assert.equal(result.body, "Hi Nia, checking in. Cal Officer, NMLS #555555. Reply STOP to opt out.");
  });

  it("refuses a draft to a borrower in a state the officer is not licensed in", () => {
    const loId = "lo_ca_only";
    writeDb((db) => {
      db.loanOfficers.push({
        id: loId, name: "Cali Only", email: "cali@example.com", nmlsId: "666666", specialties: [], weeklyWindows: [],
        licenses: [{ state: "CA", type: "mlo" }],
      } as never);
    });
    const leadId = addLead(loId, { name: "Ari Zona", email: "ari@example.com", contactConsent: true, zip: "85004" });
    const lead = readDb().borrowerLeads.find((l) => l.id === leadId)!;
    const result = withDisclosures(lead, readDb().loanOfficers.find((o) => o.id === loId)!, "email", "Hi Ari.");
    assert.ok("blocked" in result);
  });

  it("puts a visible placeholder in a draft when the officer has no NMLS ID yet", () => {
    const loId = "lo_no_nmls";
    writeDb((db) => {
      db.loanOfficers.push({ id: loId, name: "New Officer", email: "new@example.com", specialties: [], weeklyWindows: [] } as never);
    });
    const leadId = addLead(loId, { name: "Pat", email: "pat@example.com", contactConsent: true });
    const lead = readDb().borrowerLeads.find((l) => l.id === leadId)!;
    const result = withDisclosures(lead, readDb().loanOfficers.find((o) => o.id === loId)!, "email", "Hi Pat.");
    assert.ok("body" in result && result.body.includes("NMLS #[add your NMLS ID]"));
  });
});
