import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-lead-feed-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { HOUSE_OFFICER_ID } from "./crm";
import { appendBorrowerLead, appendCrmLead, readDb, saveCerebroAction, saveRevenueSubscription } from "./db";
import { generateId } from "./id";
import { buildZipLeadFeed, CLAIM_WINDOW_DAYS, defaultFeedZip, loanAmountBand, moveHouseLeadsToZipOwner, viewerHoldsZip } from "./lead-feed";
import type { BorrowerLeadRecord, QualificationSummary } from "./types";

const NOW = new Date("2026-11-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function qualification(): QualificationSummary {
  return {
    leadQuality: "strong",
    urgency: "high",
    programScores: { overallScore: 70 },
    rationale: [],
    recommendedNextStep: "Call",
    followUpPlan: "standard",
  } as unknown as QualificationSummary;
}

function lead(zip: string, overrides: Partial<BorrowerLeadRecord> = {}, answers: Partial<BorrowerLeadRecord["answers"]> = {}): BorrowerLeadRecord {
  const id = generateId("lead");
  const record: BorrowerLeadRecord = {
    id,
    createdAt: hoursAgo(5),
    assignedLoId: HOUSE_OFFICER_ID,
    crmLeadId: "",
    qualification: qualification(),
    answers: {
      loanProgram: "FHA",
      purchaseRefiIntent: "purchase",
      name: "Rosa Secretname",
      email: "rosa.secret@example.com",
      phone: "5595550199",
      contactConsent: true,
      zip,
      estimatedCreditBand: "620-679",
      timeline: "1-3 months",
      targetLoanAmountUsd: 362_000,
      ...answers,
    },
    ...overrides,
  };
  appendBorrowerLead(record);
  appendCrmLead({
    id: generateId("crm"),
    createdAt: record.createdAt,
    borrowerLeadId: id,
    assignedLoId: record.assignedLoId,
    status: "new",
    notes: [],
    qualificationSnapshot: record.qualification,
  });
  return record;
}

function owns(email: string, zip: string): void {
  saveRevenueSubscription({
    id: generateId("sub"),
    createdAt: hoursAgo(1000),
    startedAt: hoursAgo(1000),
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    ownerEmail: email,
    claimedZips: [zip],
  });
}

const viewer = { userId: "acct_viewer", email: "viewer@example.com" };

describe("loanAmountBand", () => {
  it("shows a $25k band, never the exact figure", () => {
    assert.equal(loanAmountBand({ answers: { loanProgram: "FHA", targetLoanAmountUsd: 362_000 } }), "$350k to $375k");
    assert.equal(loanAmountBand({ answers: { loanProgram: "FHA", estimatedHomeValueUsd: 500_000, estimatedDownPaymentUsd: 100_000 } }), "$400k to $425k");
    assert.equal(loanAmountBand({ answers: { loanProgram: "JUMBO", targetLoanAmountUsd: 1_210_000 } }), "$1.2M to $1.23M");
    assert.equal(loanAmountBand({ answers: { loanProgram: "VA" } }), "Not given yet");
  });
});

describe("buildZipLeadFeed", () => {
  it("rejects an invalid ZIP code", () => {
    assert.equal(buildZipLeadFeed(viewer, "abc", NOW), null);
  });

  it("shows an open ZIP code's real requests with every contact detail removed on the server", () => {
    const zip = "93611";
    const real = lead(zip);
    lead(zip, {}, { contactConsent: false });
    lead(zip, { createdAt: hoursAgo(24 * (CLAIM_WINDOW_DAYS + 1)) });
    lead("93612");
    const feed = buildZipLeadFeed(viewer, zip, NOW)!;
    assert.equal(feed.status, "open");
    assert.equal(feed.masked, true);
    assert.equal(feed.cards.length, 1);
    assert.equal(feed.cards[0].id, real.id);
    assert.equal(feed.cards[0].loanType, "Purchase · FHA");
    assert.equal(feed.cards[0].loanAmount, "$350k to $375k");
    assert.equal(feed.cards[0].contact, undefined);
    const wire = JSON.stringify(feed);
    for (const secret of ["Secretname", "rosa.secret", "5595550199", "362000"]) {
      assert.equal(wire.includes(secret), false, secret);
    }
    // Counts are real requests from the last 7 days that named this ZIP code (any routing, any consent).
    assert.equal(feed.requestsLast7Days, 2);
  });

  it("shows nothing about another officer's ZIP code", () => {
    const zip = "93615";
    owns("someone@example.com", zip);
    lead(zip, { assignedLoId: "acct_someone" });
    const feed = buildZipLeadFeed(viewer, zip, NOW)!;
    assert.equal(feed.status, "taken");
    assert.deepEqual(feed.cards, []);
    assert.equal(feed.requestsLast7Days, 0);
  });

  it("moves recent consented house requests to the new ZIP code owner once, with contact details", () => {
    const zip = "93618";
    const recent = lead(zip);
    const old = lead(zip, { createdAt: hoursAgo(24 * (CLAIM_WINDOW_DAYS + 2)) });
    const noConsent = lead(zip, {}, { contactConsent: false });
    owns(viewer.email, zip);

    const feed = buildZipLeadFeed(viewer, zip, NOW)!;
    assert.equal(feed.status, "yours");
    assert.equal(feed.masked, false);
    assert.equal(feed.movedToYou, 1);
    assert.equal(feed.cards.length, 1);
    assert.equal(feed.cards[0].contact?.name, "Rosa Secretname");

    const db = readDb();
    assert.equal(db.borrowerLeads.find((l) => l.id === recent.id)?.assignedLoId, viewer.userId);
    assert.equal(db.crmLeads.find((c) => c.borrowerLeadId === recent.id)?.assignedLoId, viewer.userId);
    assert.equal(db.borrowerLeads.find((l) => l.id === old.id)?.assignedLoId, HOUSE_OFFICER_ID);
    assert.equal(db.borrowerLeads.find((l) => l.id === noConsent.id)?.assignedLoId, HOUSE_OFFICER_ID);

    assert.equal(moveHouseLeadsToZipOwner(viewer.userId, zip, NOW), 0);
    assert.equal(buildZipLeadFeed(viewer, zip, NOW)!.movedToYou, 0);
  });

  it("drops the house officer's unsent drafts on a moved lead and hands the borrower's own requests over", () => {
    const zip = "93620";
    const moved = lead(zip);
    const base = { createdAt: hoursAgo(4), updatedAt: hoursAgo(4), loId: HOUSE_OFFICER_ID, borrowerLeadId: moved.id, channel: "email" as const, body: "Hi from the house", source: "public_chat" as const };
    saveCerebroAction({ ...base, id: "act_draft_wait", kind: "follow_up_draft", status: "awaiting_approval" });
    saveCerebroAction({ ...base, id: "act_draft_held", kind: "follow_up_draft", status: "held", approvedAt: hoursAgo(3) });
    saveCerebroAction({ ...base, id: "act_draft_ok", kind: "nudge_draft", status: "approved", approvedAt: hoursAgo(3) });
    saveCerebroAction({ ...base, id: "act_callback", kind: "callback_request", status: "awaiting_approval" });
    saveCerebroAction({ ...base, id: "act_sent", kind: "follow_up_draft", status: "sent" });
    owns(viewer.email, zip);
    assert.equal(moveHouseLeadsToZipOwner(viewer.userId, zip, NOW), 1);
    const byId = new Map(readDb().cerebroActions.map((a) => [a.id, a]));
    for (const id of ["act_draft_wait", "act_draft_held", "act_draft_ok"]) {
      assert.equal(byId.get(id)?.status, "dismissed", id);
      assert.equal(byId.get(id)?.loId, HOUSE_OFFICER_ID, id);
    }
    assert.equal(byId.get("act_callback")?.status, "awaiting_approval");
    assert.equal(byId.get("act_callback")?.loId, viewer.userId);
    assert.equal(byId.get("act_sent")?.status, "sent");
    assert.equal(buildZipLeadFeed(viewer, zip, NOW)!.movedToYou, 0);
  });
});

describe("viewerHoldsZip and defaultFeedZip", () => {
  it("a trial's pending ZIP code is not held; a locked one is, and the feed opens on it", () => {
    const trial = { userId: "acct_trial", email: "trial@example.com" };
    saveRevenueSubscription({
      id: generateId("sub"),
      createdAt: hoursAgo(10),
      startedAt: hoursAgo(10),
      tier: "growth",
      status: "trialing",
      source: "stripe_webhook",
      ownerEmail: trial.email,
      claimedZips: [],
      pendingZip: "93630",
    });
    assert.equal(viewerHoldsZip(trial), false);
    assert.equal(defaultFeedZip(trial), null);
    const owner = { userId: "acct_owner2", email: "owner2@example.com" };
    owns(owner.email, "93631");
    assert.equal(viewerHoldsZip(owner), true);
    assert.equal(defaultFeedZip(owner), "93631");
  });
});
