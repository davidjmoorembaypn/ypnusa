import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-cerebro-queue-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { dispatchCerebroMessages } from "./cerebro-dispatch";
import { cerebroSendsIt, decideQueuedAction, MAX_EDITED_BODY, officerForEmail, queueViewFor } from "./cerebro-queue";
import { appendBorrowerLead, readDb, saveCerebroAction, writeDb } from "./db";
import type { SendEmailInput } from "./email";
import { generateId } from "./id";
import type { CerebroQueuedActionRecord, LoanOfficerRecord } from "./types";

const qualification = { programScores: {}, leadQuality: "strong" as const, urgency: "high" as const, recommendedNextStep: "Call", rationale: [] };
const noon = new Date("2026-11-20T20:00:00Z"); // midday in California

function addOfficer(overrides: Partial<LoanOfficerRecord> = {}): LoanOfficerRecord {
  const officer: LoanOfficerRecord = {
    ...readDb().loanOfficers[0],
    id: generateId("lo"),
    name: "Dana Reyes",
    email: `dana-${Math.random().toString(36).slice(2)}@lender.test`,
    nmlsId: "123456",
    licenses: [{ state: "CA", type: "mlo" }],
    cerebroReplyMode: "approve",
    ...overrides,
  };
  writeDb((db) => {
    db.loanOfficers.push(officer);
  });
  return officer;
}

function addLead(loId: string, name = "Sam Buyer"): string {
  const id = generateId("lead");
  appendBorrowerLead({
    id,
    createdAt: noon.toISOString(),
    assignedLoId: loId,
    qualification,
    crmLeadId: "",
    answers: { loanProgram: "CONVENTIONAL", name, email: "sam@borrowermail.com", zip: "93291", contactConsent: true },
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

const stored = (id: string) => readDb().cerebroActions.find((item) => item.id === id);

describe("the approval queue", () => {
  it("finds the officer by the signed-in email, whatever its case", () => {
    const officer = addOfficer();
    assert.equal(officerForEmail(` ${officer.email.toUpperCase()} `)?.id, officer.id);
    assert.equal(officerForEmail("nobody@lender.test"), undefined);
    assert.equal(officerForEmail(undefined), undefined);
    assert.equal(officerForEmail(""), undefined);
  });

  it("shows what is waiting, what was sent and what is held, for this officer only", () => {
    const officer = addOfficer();
    const other = addOfficer();
    const lead = addLead(officer.id);
    const waiting = queue(officer.id, lead, { holdReason: "Needs your OK: the borrower's state isn't known." });
    const text = queue(officer.id, lead, { kind: "callback_request", channel: "text", preferredWindow: "weekday evenings" });
    queue(officer.id, lead, { status: "sent", sentAt: noon.toISOString() });
    queue(officer.id, lead, { status: "held" });
    queue(officer.id, lead, { status: "dismissed" });
    queue(other.id, addLead(other.id, "Other Borrower"));

    const view = queueViewFor(officer);
    assert.equal(view.replyMode, "approve");
    assert.deepEqual(
      view.waiting.map((item) => [item.id, item.borrower, item.cerebroSends, item.needsYou, item.preferredWindow]),
      [
        [waiting.id, "Sam Buyer", true, "Needs your OK: the borrower's state isn't known.", undefined],
        [text.id, "Sam Buyer", false, undefined, "weekday evenings"],
      ],
    );
    assert.equal(view.recentlySent.length, 1);
    assert.equal(view.waitingToSend, 1);
    assert.equal(queueViewFor(addOfficer({ cerebroReplyMode: undefined })).replyMode, "live");
  });

  it("knows which kinds Cerebro sends itself", () => {
    assert.equal(cerebroSendsIt({ kind: "follow_up_draft", channel: "email" }), true);
    assert.equal(cerebroSendsIt({ kind: "rate_alert_draft", channel: "email" }), true);
    assert.equal(cerebroSendsIt({ kind: "follow_up_draft", channel: "text" }), false);
    assert.equal(cerebroSendsIt({ kind: "prequal_letter_draft", channel: "email" }), false);
    assert.equal(cerebroSendsIt({ kind: "callback_request", channel: "phone" }), false);
  });

  it("approves with the officer's edit, and the sender then emails that wording", async () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id));
    const edited = "Hi Sam,\n\nThanks for your note. Is Tuesday afternoon good for a call?\n\nDana";

    const result = decideQueuedAction({ officer, actionId: action.id, decision: "approve", editedBody: `  ${edited}  `, now: noon });
    assert.deepEqual(result, { ok: true, decision: "approve", cerebroSends: true, finalText: edited });
    const saved = stored(action.id);
    assert.equal(saved?.status, "approved");
    assert.equal(saved?.body, edited);
    assert.equal(saved?.approvedAt, noon.toISOString());

    const sent: SendEmailInput[] = [];
    await dispatchCerebroMessages(noon, async (input) => {
      sent.push(input);
      return { sent: true };
    });
    const mine = sent.filter((input) => input.html.includes("Tuesday afternoon"));
    assert.equal(mine.length, 1);
    assert.equal(stored(action.id)?.status, "sent");
  });

  it("refuses to approve an email whose wording breaks an advertising rule, and changes nothing", () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id));

    const result = decideQueuedAction({ officer, actionId: action.id, decision: "approve", editedBody: "Hi Sam, I can guarantee you a 5.25% rate today." });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && result.code === "NEEDS_CHANGES" && result.problems.length >= 2);
    assert.equal(stored(action.id)?.status, "awaiting_approval");
    assert.equal(stored(action.id)?.body, action.body);

    // The unedited draft is checked too, not only an edit.
    const risky = queue(officer.id, addLead(officer.id), { body: "Rates are the lowest rates in years. Act now!" });
    const second = decideQueuedAction({ officer, actionId: risky.id, decision: "approve" });
    assert.ok(!second.ok && second.code === "NEEDS_CHANGES");

    // Dismissing never needs the wording to pass.
    assert.deepEqual(decideQueuedAction({ officer, actionId: risky.id, decision: "dismiss" }), {
      ok: true,
      decision: "dismiss",
      cerebroSends: false,
      finalText: risky.body,
    });
    assert.equal(stored(risky.id)?.status, "dismissed");
    assert.equal(stored(risky.id)?.approvedAt, undefined);
  });

  it("does not check kinds the officer sends themselves, and hands back the final text", () => {
    const officer = addOfficer();
    const letter = queue(officer.id, addLead(officer.id), {
      kind: "prequal_letter_draft",
      body: "Sam Buyer is prequalified for a purchase up to $400,000 with a down payment of $20,000.",
    });
    const result = decideQueuedAction({ officer, actionId: letter.id, decision: "approve" });
    assert.deepEqual(result, { ok: true, decision: "approve", cerebroSends: false, finalText: letter.body });
    assert.equal(stored(letter.id)?.status, "approved");
  });

  it("clears the reason it was sent back once the officer decides", () => {
    const officer = addOfficer();
    const action = queue(officer.id, addLead(officer.id), { holdReason: "Needs your OK: the borrower's state isn't known." });
    assert.ok(decideQueuedAction({ officer, actionId: action.id, decision: "approve" }).ok);
    assert.equal(stored(action.id)?.holdReason, undefined);
  });

  it("will not decide another officer's item, a missing item, or one already decided", () => {
    const officer = addOfficer();
    const other = addOfficer();
    const theirs = queue(other.id, addLead(other.id));
    assert.deepEqual(decideQueuedAction({ officer, actionId: theirs.id, decision: "dismiss" }), { ok: false, code: "NOT_FOUND" });
    assert.equal(stored(theirs.id)?.status, "awaiting_approval");
    assert.deepEqual(decideQueuedAction({ officer, actionId: "act_missing", decision: "approve" }), { ok: false, code: "NOT_FOUND" });

    const mine = queue(officer.id, addLead(officer.id));
    assert.ok(decideQueuedAction({ officer, actionId: mine.id, decision: "approve" }).ok);
    assert.deepEqual(decideQueuedAction({ officer, actionId: mine.id, decision: "dismiss" }), { ok: false, code: "ALREADY_DECIDED", status: "approved" });
  });

  it("keeps the draft when the edit is blank, and caps a long edit", () => {
    const officer = addOfficer();
    const blank = queue(officer.id, addLead(officer.id));
    const kept = decideQueuedAction({ officer, actionId: blank.id, decision: "approve", editedBody: "   " });
    assert.ok(kept.ok && kept.finalText === blank.body);

    const long = queue(officer.id, addLead(officer.id), { kind: "callback_request", channel: "phone" });
    const capped = decideQueuedAction({ officer, actionId: long.id, decision: "approve", editedBody: "x".repeat(MAX_EDITED_BODY + 50) });
    assert.ok(capped.ok && capped.finalText.length === MAX_EDITED_BODY);
  });
});
