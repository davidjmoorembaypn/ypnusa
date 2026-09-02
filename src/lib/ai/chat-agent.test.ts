import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { generateId } from "../id";
import type { AssistantMode, ChatSessionRecord } from "../types";
import { readChatSession, readDb } from "../db";
import { linkQualifiedLead, runAssistantTurn } from "./chat-agent";
import { buildSystemPrompt } from "./prompts";
import { resetAiProviderCache } from "./provider";

// db.ts resolves its data directory lazily (on first read/write call, not at
// module load — see db.ts's dataDir()), so setting this before any test body
// runs is sufficient even though the imports above are hoisted ahead of it.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-chat-agent-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

// NOTE ON COVERAGE GAP: runAssistantTurn's "provider configured" path (the
// real Anthropic tool-calling turn) is intentionally NOT covered here. It
// needs either a live ANTHROPIC_API_KEY (never acceptable in an automated
// test) or mocking @anthropic-ai/sdk, which is out of scope for this task.
// Everything below exercises the "no provider configured" branch, which is
// deterministic and network-free.

let savedApiKey: string | undefined;

before(() => {
  savedApiKey = process.env.ANTHROPIC_API_KEY;
});

after(() => {
  if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey;
  else delete process.env.ANTHROPIC_API_KEY;
  resetAiProviderCache();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  resetAiProviderCache();
});

afterEach(() => {
  resetAiProviderCache();
});

describe("runAssistantTurn — no provider configured", () => {
  it("returns providerConfigured: false with a canned setup reply, and persists the session", async () => {
    const result = await runAssistantTurn({ mode: "public_site", userMessage: "hi" });

    assert.equal(result.providerConfigured, false);
    assert.ok(result.reply.length > 0);
    assert.match(result.reply, /AI provider/i);

    const stored = readChatSession(result.sessionId);
    assert.ok(stored);
    assert.equal(stored?.messages.length, 2);
    assert.equal(stored?.messages[0].role, "user");
    assert.equal(stored?.messages[0].content, "hi");
    assert.equal(stored?.messages[1].role, "assistant");
    assert.equal(stored?.messages[1].content, result.reply);
  });

  it("accumulates messages in the same session across repeat calls with the same sessionId", async () => {
    const first = await runAssistantTurn({ mode: "public_site", userMessage: "first message" });
    const second = await runAssistantTurn({
      mode: "public_site",
      sessionId: first.sessionId,
      userMessage: "second message",
    });

    assert.equal(second.sessionId, first.sessionId);

    const stored = readChatSession(first.sessionId);
    assert.equal(stored?.messages.length, 4);
    assert.equal(stored?.messages[0].content, "first message");
    assert.equal(stored?.messages[2].content, "second message");
  });

  it("does not resume an mlo_dashboard session for a different userId", async () => {
    const first = await runAssistantTurn({
      mode: "mlo_dashboard",
      userId: "user_a",
      userMessage: "what's my pipeline look like",
    });

    const second = await runAssistantTurn({
      mode: "mlo_dashboard",
      sessionId: first.sessionId,
      userId: "user_b",
      userMessage: "hijack attempt",
    });

    // Ownership check in loadOrCreateSession: a different userId must not
    // resume user_a's transcript — it falls through to a brand-new session.
    assert.notEqual(second.sessionId, first.sessionId);

    const firstStored = readChatSession(first.sessionId);
    assert.equal(firstStored?.userId, "user_a");
    assert.equal(firstStored?.messages.length, 2);

    const secondStored = readChatSession(second.sessionId);
    assert.equal(secondStored?.userId, "user_b");
    assert.equal(secondStored?.messages.length, 2);
    assert.equal(secondStored?.messages[0].content, "hijack attempt");
  });

  it("leaves capturedFields empty for lead_qualification mode since the tool-call path never runs", async () => {
    const result = await runAssistantTurn({
      mode: "lead_qualification",
      userMessage: "I'm looking to buy a house",
    });

    assert.deepEqual(result.capturedFields, {});
  });
});

function makeQualifiedSession(overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  const now = new Date().toISOString();
  return {
    id: generateId("chat"),
    mode: "lead_qualification",
    createdAt: now,
    updatedAt: now,
    messages: [],
    capturedFields: {
      name: "Jamie Rivera",
      email: "jamie@example.com",
      phone: "555-0100",
      leadType: "buyer",
      urgency: "high",
      consent: true,
    },
    summary: "Wants to buy in the next 60 days.",
    leadScore: 82,
    recommendedAction: "Call within the hour.",
    status: "qualified",
    ...overrides,
  };
}

describe("linkQualifiedLead", () => {
  it("links a qualified consumer lead by creating and setting borrowerLeadId", () => {
    const session = makeQualifiedSession();
    linkQualifiedLead(session);

    assert.ok(session.borrowerLeadId);
    const db = readDb();
    const lead = db.borrowerLeads.find((l) => l.id === session.borrowerLeadId);
    assert.ok(lead);
    assert.equal(lead?.answers.name, "Jamie Rivera");
    assert.equal(lead?.sessionId, session.id);
  });

  it("links the paired CRM lead and sets crmLeadId", () => {
    const session = makeQualifiedSession();
    linkQualifiedLead(session);

    assert.ok(session.crmLeadId);
    const db = readDb();
    const crm = db.crmLeads.find((c) => c.id === session.crmLeadId);
    assert.ok(crm);
    assert.equal(crm?.borrowerLeadId, session.borrowerLeadId);
  });

  it("does not create a duplicate lead when the session already has a linked borrowerLeadId", () => {
    const session = makeQualifiedSession({ borrowerLeadId: "lead_existing" });
    const before = readDb().borrowerLeads.length;

    linkQualifiedLead(session);

    assert.equal(session.borrowerLeadId, "lead_existing");
    assert.equal(session.crmLeadId, undefined);
    assert.equal(readDb().borrowerLeads.length, before);
  });

  it("does not create a duplicate lead when the session already has a linked crmLeadId", () => {
    const session = makeQualifiedSession({ crmLeadId: "crm_existing" });
    const before = readDb().crmLeads.length;

    linkQualifiedLead(session);

    assert.equal(session.borrowerLeadId, undefined);
    assert.equal(session.crmLeadId, "crm_existing");
    assert.equal(readDb().crmLeads.length, before);
  });

  it("does not create a lead for an incomplete (not-yet-qualified) session", () => {
    const session = makeQualifiedSession({ status: "active" });
    const before = readDb().borrowerLeads.length;

    linkQualifiedLead(session);

    assert.equal(session.borrowerLeadId, undefined);
    assert.equal(session.crmLeadId, undefined);
    assert.equal(readDb().borrowerLeads.length, before);
  });
});

describe("buildSystemPrompt", () => {
  it("returns a non-empty, distinct prompt for each assistant mode", () => {
    const modes: AssistantMode[] = ["public_site", "mlo_dashboard", "lead_qualification"];
    const prompts = modes.map((mode) => buildSystemPrompt(mode));

    for (const prompt of prompts) {
      assert.ok(typeof prompt === "string" && prompt.length > 0);
    }
    assert.equal(new Set(prompts).size, prompts.length);
  });

  it("throws on an unhandled mode", () => {
    assert.throws(() => buildSystemPrompt("not_a_real_mode" as AssistantMode));
  });
});
