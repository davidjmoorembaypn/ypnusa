import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-chat-lead-journey-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { CHAT_LEAD_JOURNEY_PLANS, chatLeadJourneyEnabled, processDueFollowUps, scheduleBorrowerJourney } from "../automation";
import { recordOptOutAllChannels } from "../consent";
import { readDb } from "../db";
import { generateId } from "../id";
import type { ChatSessionRecord } from "../types";
import { linkQualifiedLead } from "./chat-agent";

const DAY = 24 * 60 * 60 * 1000;

function qualifiedSession(fields: Partial<ChatSessionRecord["capturedFields"]> = {}): ChatSessionRecord {
  const now = new Date().toISOString();
  return {
    id: generateId("chat"),
    mode: "lead_qualification",
    createdAt: now,
    updatedAt: now,
    messages: [],
    capturedFields: { name: "Jamie Rivera", email: "jamie@borrowermail.com", phone: "555-0100", leadType: "buyer", urgency: "high", consent: true, ...fields },
    summary: "Wants to buy in the next 60 days.",
    leadScore: 82,
    recommendedAction: "Call within the hour.",
    status: "qualified",
  };
}

const jobsFor = (leadId: string | undefined) => readDb().followUps.filter((job) => job.borrowerLeadId === leadId);

describe("follow-up emails for chat leads", () => {
  afterEach(() => {
    delete process.env.CHAT_LEAD_JOURNEY_ENABLED;
  });

  it("is off unless the server setting is exactly true", () => {
    const env = (value?: string) => ({ CHAT_LEAD_JOURNEY_ENABLED: value }) as unknown as NodeJS.ProcessEnv;
    assert.equal(chatLeadJourneyEnabled(env()), false);
    assert.equal(chatLeadJourneyEnabled(env("1")), false);
    assert.equal(chatLeadJourneyEnabled(env("yes")), false);
    assert.equal(chatLeadJourneyEnabled(env(" TRUE ")), true);
  });

  it("queues nothing while the setting is off", () => {
    const session = qualifiedSession();
    linkQualifiedLead(session);
    assert.ok(session.borrowerLeadId, "the lead is still created");
    assert.deepEqual(jobsFor(session.borrowerLeadId), []);
  });

  it("queues the five emails, and no instant message or text, when the setting is on", () => {
    process.env.CHAT_LEAD_JOURNEY_ENABLED = "true";
    const before = Date.now();
    const session = qualifiedSession();
    linkQualifiedLead(session);

    const jobs = jobsFor(session.borrowerLeadId);
    assert.deepEqual(
      jobs.map((job) => job.plan),
      ["day_1_educational_email", "day_3_book_call_email", "day_30_check_in", "day_60_check_in", "day_90_check_in"],
    );
    assert.ok(jobs.every((job) => job.channel === "email" && job.recipient === "jamie@borrowermail.com" && job.status === "pending"));
    const daysOut = jobs.map((job) => Math.round((Date.parse(job.scheduledAt) - before) / DAY));
    assert.deepEqual(daysOut, [1, 3, 30, 60, 90]);

    // Linking the same session again never queues a second set.
    linkQualifiedLead(session);
    assert.equal(jobsFor(session.borrowerLeadId).length, 5);
  });

  it("queues nothing without consent or without an email address", () => {
    process.env.CHAT_LEAD_JOURNEY_ENABLED = "true";
    const noConsent = qualifiedSession({ consent: false });
    linkQualifiedLead(noConsent);
    assert.deepEqual(jobsFor(noConsent.borrowerLeadId), []);

    const phoneOnly = qualifiedSession({ email: undefined });
    linkQualifiedLead(phoneOnly);
    assert.ok(phoneOnly.borrowerLeadId);
    assert.deepEqual(jobsFor(phoneOnly.borrowerLeadId), [], "a chat lead is never texted on a schedule");
  });

  it("only emails someone buying or refinancing", () => {
    process.env.CHAT_LEAD_JOURNEY_ENABLED = "true";
    const refinance = qualifiedSession({ leadType: "refinance", email: "refi@borrowermail.com" });
    linkQualifiedLead(refinance);
    assert.equal(jobsFor(refinance.borrowerLeadId).length, 5);

    for (const leadType of ["seller", "other"] as const) {
      const session = qualifiedSession({ leadType, email: `${leadType}@borrowermail.com` });
      linkQualifiedLead(session);
      assert.ok(session.borrowerLeadId);
      assert.deepEqual(jobsFor(session.borrowerLeadId), [], `${leadType} leads get no mortgage follow-ups`);
    }
  });

  it("cancels the emails when the borrower opts out before they come due", async () => {
    process.env.CHAT_LEAD_JOURNEY_ENABLED = "true";
    const session = qualifiedSession({ email: "optout@borrowermail.com" });
    linkQualifiedLead(session);
    const leadId = session.borrowerLeadId as string;
    assert.equal(jobsFor(leadId).length, 5);

    recordOptOutAllChannels(leadId, "test:unsubscribe");
    await processDueFollowUps({ borrowerLeadId: leadId, now: new Date(Date.now() + 4 * DAY) });
    const after = jobsFor(leadId);
    assert.deepEqual(
      after.filter((job) => job.plan === "day_1_educational_email" || job.plan === "day_3_book_call_email").map((job) => job.status),
      ["cancelled", "cancelled"],
    );
    assert.equal(after.some((job) => job.status === "sent"), false);
  });

  it("leaves the form journey unchanged, and can queue a chosen subset", () => {
    const full = scheduleBorrowerJourney("lead_form_full", { loanProgram: "FHA", contactConsent: true, email: "form@borrowermail.com", phone: "555-0101" });
    assert.equal(full.length, 8);
    const subset = scheduleBorrowerJourney(
      "lead_form_subset",
      { loanProgram: "FHA", contactConsent: true, email: "form@borrowermail.com", phone: "555-0101" },
      { plans: CHAT_LEAD_JOURNEY_PLANS },
    );
    assert.equal(subset.length, 5);
    assert.equal(subset.some((job) => job.plan.startsWith("immediate_") || job.plan === "day_5_urgency_email" || job.channel === "sms"), false);
  });
});
