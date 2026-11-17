import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-cerebro-dispatch-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { dispatchCerebroMessages, unsubscribeToken, verifyUnsubscribeToken } from "./cerebro-dispatch";
import { recordOptOutAllChannels } from "./consent";
import { appendBorrowerLead, readDb, saveCerebroAction, writeDb } from "./db";
import type { SendEmailInput } from "./email";
import { generateId } from "./id";
import type { BorrowerLeadRecord, CerebroQueuedActionRecord, LoanOfficerRecord } from "./types";
import { unsubscribeBorrower } from "./unsubscribe";

const qualification = { programScores: {}, leadQuality: "strong" as const, urgency: "high" as const, recommendedNextStep: "Call", rationale: [] };
const noon = new Date("2026-11-16T20:00:00Z"); // midday in California

function addOfficer(overrides: Partial<LoanOfficerRecord> = {}): LoanOfficerRecord {
  const officer: LoanOfficerRecord = {
    ...readDb().loanOfficers[0],
    id: generateId("lo"),
    name: "Dana Reyes",
    email: `dana-${Math.random().toString(36).slice(2)}@lender.test`,
    nmlsId: "123456",
    licenses: [{ state: "CA", type: "mlo" }],
    ...overrides,
  };
  writeDb((db) => {
    db.loanOfficers.push(officer);
  });
  return officer;
}

function addLead(loId: string, answers: Partial<BorrowerLeadRecord["answers"]> = {}): string {
  const id = generateId("lead");
  appendBorrowerLead({
    id,
    createdAt: noon.toISOString(),
    assignedLoId: loId,
    qualification,
    crmLeadId: "",
    answers: { loanProgram: "CONVENTIONAL", name: "Sam Buyer", email: "sam@borrowermail.com", zip: "93291", contactConsent: true, ...answers },
  });
  return id;
}

function queue(loId: string, borrowerLeadId: string, overrides: Partial<CerebroQueuedActionRecord> = {}): CerebroQueuedActionRecord {
  const action: CerebroQueuedActionRecord = {
    id: generateId("act"),
    createdAt: noon.toISOString(),
    updatedAt: noon.toISOString(),
    loId,
    borrowerLeadId,
    kind: "follow_up_draft",
    status: "awaiting_approval",
    channel: "email",
    subject: "Following up on your home search",
    body: "Hi Sam,\n\nYou asked on ypnus.com about buying a home. What's a good time for a quick call?\n\nDana",
    source: "public_chat",
    ...overrides,
  };
  saveCerebroAction(action);
  return action;
}

const stored = (id: string) => readDb().cerebroActions.find((item) => item.id === id)!;

async function run() {
  const sent: SendEmailInput[] = [];
  const result = await dispatchCerebroMessages(noon, async (input) => {
    sent.push(input);
    return { sent: true };
  });
  return { result, sent };
}

describe("Cerebro dispatch", () => {
  it("emails a consenting borrower on its own in live mode, with disclosures, AI line and unsubscribe", async () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id));
    const { sent } = await run();
    const mine = sent.filter((mail) => mail.replyTo === officer.email);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].to, "sam@borrowermail.com");
    assert.match(mine[0].html, /Sent by Cerebro, the AI assistant for Dana Reyes/);
    assert.match(mine[0].html, /NMLS #123456/);
    assert.match(mine[0].html, /Equal Housing Opportunity/);
    assert.match(mine[0].html, /unsubscribe\?l=/);
    assert.match(mine[0].headers?.["List-Unsubscribe"] ?? "", /api\/unsubscribe/);
    assert.equal(stored(action.id).status, "sent");
    // Sent once only.
    const again = await run();
    assert.equal(again.sent.filter((mail) => mail.replyTo === officer.email).length, 0);
  });

  it("never sends a draft written for an officer the lead no longer belongs to", async () => {
    const before = addOfficer();
    const after = addOfficer();
    const leadId = addLead(after.id);
    const action = queue(before.id, leadId, { status: "approved", approvedAt: noon.toISOString() });
    const { sent } = await run();
    assert.equal(sent.filter((mail) => mail.replyTo === before.email).length, 0);
    assert.equal(stored(action.id).status, "approved");
  });

  it("waits for the officer in approve mode, then sends once approved", async () => {
    const officer = addOfficer({ cerebroReplyMode: "approve" });
    const action = queue(officer.id, addLead(officer.id));
    assert.equal((await run()).sent.filter((mail) => mail.replyTo === officer.email).length, 0);
    assert.equal(stored(action.id).status, "awaiting_approval");
    saveCerebroAction({ ...stored(action.id), status: "approved", approvedAt: noon.toISOString() });
    const { sent } = await run();
    const mine = sent.filter((mail) => mail.replyTo === officer.email);
    assert.equal(mine.length, 1);
    assert.doesNotMatch(mine[0].html, /Sent by Cerebro, the AI assistant/);
  });

  it("sends nothing on its own to a state the officer isn't licensed in", async () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id, { zip: "75001" }));
    assert.equal((await run()).sent.filter((mail) => mail.replyTo === officer.email).length, 0);
    assert.equal(stored(action.id).status, "awaiting_approval");
    assert.match(stored(action.id).holdReason ?? "", /^Needs your OK/);
  });

  it("sends nothing on its own when the officer hasn't listed licensed states", async () => {
    const officer = addOfficer({ licenses: [] });
    const action = queue(officer.id, addLead(officer.id));
    await run();
    assert.match(stored(action.id).holdReason ?? "", /license for CA/);
  });

  it("never emails a borrower who opted out or never consented", async () => {
    const officer = addOfficer();
    const optedOut = addLead(officer.id);
    recordOptOutAllChannels(optedOut, "test");
    const a = queue(officer.id, optedOut);
    const b = queue(officer.id, addLead(officer.id, { contactConsent: false }));
    assert.equal((await run()).sent.filter((mail) => mail.replyTo === officer.email).length, 0);
    assert.match(stored(a.id).holdReason ?? "", /opted out/);
    assert.match(stored(b.id).holdReason ?? "", /consent/);
  });

  it("holds texts, refuses drafts with rates or a missing NMLS, and never sends prequal letters", async () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    const text = queue(officer.id, lead, { channel: "text", body: "Hi Sam, quick check-in. Reply STOP to opt out." });
    const rate = queue(officer.id, lead, { body: "Rates just hit 5.9% APR!" });
    const placeholder = queue(officer.id, lead, { body: "Hi Sam. NMLS #[add your NMLS ID]" });
    const letter = queue(officer.id, lead, { kind: "prequal_letter_draft", status: "approved" });
    assert.equal((await run()).sent.filter((mail) => mail.replyTo === officer.email).length, 0);
    assert.equal(stored(text.id).status, "held");
    assert.match(stored(rate.id).holdReason ?? "", /rate/i);
    assert.match(stored(placeholder.id).holdReason ?? "", /NMLS/);
    assert.equal(stored(letter.id).status, "approved");
  });

  it("keeps a failed send for the next pass", async () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id));
    await dispatchCerebroMessages(noon, async () => ({ sent: false, reason: "Resend down" }));
    assert.equal(stored(action.id).status, "held");
    const { sent } = await run();
    assert.equal(sent.filter((mail) => mail.replyTo === officer.email).length, 1);
  });
});

describe("unsubscribe links", () => {
  it("only accepts this lead's own signed token, and opts the borrower out of everything", () => {
    const officer = addOfficer();
    const lead = addLead(officer.id);
    const other = addLead(officer.id);
    assert.equal(verifyUnsubscribeToken(lead, unsubscribeToken(other)), false);
    assert.equal(unsubscribeBorrower(lead, "forged", "test"), false);
    assert.equal(unsubscribeBorrower(lead, unsubscribeToken(lead), "test"), true);
    const latest = readDb().consents.filter((item) => item.borrowerLeadId === lead);
    assert.deepEqual(new Set(latest.map((item) => item.channel)), new Set(["sms", "call", "email", "ai_voice"]));
    assert.ok(latest.every((item) => item.granted === false));
  });
});

describe("Cerebro dispatch safety", () => {
  it("never auto-sends drafts queued before live replies, or to test leads", async () => {
    const officer = addOfficer();
    const old = queue(officer.id, addLead(officer.id), { createdAt: "2026-11-15T18:00:00Z" });
    const test = queue(officer.id, addLead(officer.id, { email: "someone@example.com" }));
    const marked = queue(officer.id, addLead(officer.id, { name: "Test Borrower (Claude test)" }));
    assert.equal((await run()).sent.filter((mail) => mail.replyTo === officer.email).length, 0);
    assert.equal(stored(old.id).status, "awaiting_approval");
    assert.equal(stored(test.id).status, "awaiting_approval");
    assert.equal(stored(marked.id).status, "awaiting_approval");
  });
});
