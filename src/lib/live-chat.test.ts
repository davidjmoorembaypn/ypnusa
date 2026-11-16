import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { ChatSessionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-live-chat-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
for (const key of ["AI_PROVIDER", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) delete process.env[key];

const OWNER = { sub: "acct_owner", role: "mlo" };
const OTHER = { sub: "acct_other", role: "mlo" };
const ADMIN = { sub: "acct_admin", role: "admin" };

function chat(id: string, overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  const now = new Date().toISOString();
  return {
    id,
    mode: "lead_qualification",
    createdAt: now,
    updatedAt: now,
    officerUserId: OWNER.sub,
    officerSlug: "jane-doe-abc123",
    messages: [{ id: `${id}_m1`, role: "user", content: "Hi, I want to buy a home", createdAt: now }],
    capturedFields: { name: "Sam Lee" },
    status: "active",
    ...overrides,
  };
}

describe("live chat takeover", async () => {
  const { writeDb, readChatSession } = await import("./db");
  const live = await import("./live-chat");
  const { runAssistantTurn } = await import("./ai/chat-agent");

  beforeEach(() => {
    writeDb((db) => {
      db.chatSessions = [
        chat("chat_owned"),
        chat("chat_foreign", { officerUserId: OTHER.sub }),
        chat("chat_public", { mode: "public_site", officerUserId: OWNER.sub }),
      ];
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("lets only the owning officer or an admin manage a borrower chat", () => {
    const owned = readChatSession("chat_owned")!;
    assert.equal(live.canManageChat(owned, OWNER), true);
    assert.equal(live.canManageChat(owned, OTHER), false);
    assert.equal(live.canManageChat(owned, ADMIN), true);
    assert.equal(live.canManageChat(readChatSession("chat_public")!, OWNER), false, "never a non-borrower chat");
  });

  it("refuses takeover and replies from another officer", () => {
    const result = live.takeOverChat("chat_owned", OTHER);
    assert.deepEqual(result, { ok: false, code: "FORBIDDEN" });
    assert.equal(readChatSession("chat_owned")!.handledBy, undefined);
    assert.deepEqual(live.officerReply("chat_owned", OTHER, "hello"), { ok: false, code: "FORBIDDEN" });
  });

  it("requires a takeover before the officer can reply, then marks the reply as the officer's", () => {
    assert.deepEqual(live.officerReply("chat_owned", OWNER, "hello"), { ok: false, code: "NOT_TAKEN_OVER" });
    assert.equal(live.takeOverChat("chat_owned", OWNER).ok, true);
    assert.deepEqual(live.officerReply("chat_owned", OWNER, "   "), { ok: false, code: "EMPTY_MESSAGE" });
    const replied = live.officerReply("chat_owned", OWNER, "Hi Sam, Jane here.");
    assert.equal(replied.ok, true);
    const stored = readChatSession("chat_owned")!;
    const last = stored.messages.at(-1)!;
    assert.equal(last.role, "assistant");
    assert.equal(last.author, "officer");
    assert.equal(live.transcriptMessages(stored).at(-1)!.from, "officer");
    assert.equal(live.handBackChat("chat_owned", OWNER).ok, true);
    assert.equal(readChatSession("chat_owned")!.handledBy, "ai");
  });

  it("keeps Cerebro silent while the officer has taken over", async () => {
    live.takeOverChat("chat_owned", OWNER);
    const result = await runAssistantTurn({
      mode: "lead_qualification",
      sessionId: "chat_owned",
      userMessage: "Are you there?",
    });
    assert.equal(result.humanMode, true);
    assert.equal(result.reply, "");
    const stored = readChatSession("chat_owned")!;
    assert.equal(stored.messages.at(-1)!.content, "Are you there?");
    assert.equal(stored.messages.filter((message) => message.role === "assistant").length, 0);
  });

  it("does not let a slow AI turn undo a takeover that happened meanwhile", () => {
    const stale = readChatSession("chat_owned")!;
    live.takeOverChat("chat_owned", OWNER);
    live.officerReply("chat_owned", OWNER, "I'll take it from here.");
    assert.equal(live.reconcileWithStored(stale), true);
    assert.equal(stale.handledBy, "officer");
    assert.ok(stale.messages.some((message) => message.author === "officer"));
  });

  it("lists only the viewer's own recent borrower chats", () => {
    assert.deepEqual(live.listLiveChats(OWNER).map((item) => item.sessionId), ["chat_owned"]);
    assert.deepEqual(live.listLiveChats(OTHER).map((item) => item.sessionId), ["chat_foreign"]);
    assert.equal(live.listLiveChats(ADMIN).length, 2);
    const summary = live.listLiveChats(OWNER)[0];
    assert.equal(summary.borrowerLabel, "Sam L.");
    assert.equal(summary.awaitingReply, true);
  });

  it("drops chats with no activity in 7 days from the list", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    writeDb((db) => {
      db.chatSessions = [chat("chat_old", { updatedAt: old })];
    });
    assert.equal(live.listLiveChats(OWNER).length, 0);
  });
  it("keeps a takeover that happens while Cerebro is still writing its reply", async () => {
    const { setAiProviderForTests } = await import("./ai/provider");
    setAiProviderForTests({
      name: "test",
      async generate() {
        // The officer takes over and replies while the model is still answering.
        live.takeOverChat("chat_owned", OWNER);
        live.officerReply("chat_owned", OWNER, "Hi Sam, Jane here.");
        return { text: "Cerebro's late answer", toolCalls: [], stopReason: "end_turn" };
      },
    });
    try {
      const result = await runAssistantTurn({ mode: "lead_qualification", sessionId: "chat_owned", userMessage: "Anyone there?" });
      assert.equal(result.humanMode, true);
      const stored = readChatSession("chat_owned")!;
      assert.equal(stored.handledBy, "officer");
      const contents = stored.messages.map((message) => message.content);
      assert.ok(contents.includes("Hi Sam, Jane here."));
      assert.ok(contents.includes("Anyone there?"));
      assert.equal(contents.includes("Cerebro's late answer"), false);
    } finally {
      setAiProviderForTests(undefined);
    }
  });

  it("gives the chat to the officer the lead was moved to", () => {
    writeDb((db) => {
      db.crmLeads = [
        {
          id: "crm_moved",
          createdAt: new Date().toISOString(),
          borrowerLeadId: "lead_moved",
          assignedLoId: OTHER.sub,
          status: "new_ai_routed",
          notes: [],
          qualificationSnapshot: { programScores: {}, leadQuality: "developing", urgency: "standard", recommendedNextStep: "", rationale: [] },
        },
      ];
      db.chatSessions.push(chat("chat_moved", { crmLeadId: "crm_moved", borrowerLeadId: "lead_moved" }));
    });
    const moved = readChatSession("chat_moved")!;
    assert.equal(live.chatOwnerId(moved), OTHER.sub);
    assert.equal(live.canManageChat(moved, OTHER), true);
    assert.equal(live.canManageChat(moved, OWNER), false);
  });
});

describe("officer licensing for page chats", async () => {
  const { officerLicensedFor, officerChatPrompt } = await import("./live-chat");

  it("uses the borrower's ZIP code first", () => {
    const ca = { licensedStates: ["CA"] };
    assert.equal(officerLicensedFor(ca, { zip: "93277" }), true);
    assert.equal(officerLicensedFor(ca, { zip: "85004" }), false);
    assert.equal(officerLicensedFor(ca, { state: "az" }), false);
    assert.equal(officerLicensedFor(ca, { state: "California" }), true, "a spelled-out state is unknown, not a block");
    assert.equal(officerLicensedFor({ licensedStates: [] }, { zip: "85004" }), true, "no licenses on file: warn, don't block");
  });

  it("tells Cerebro it is the officer's AI assistant and where the officer is licensed", () => {
    const prompt = officerChatPrompt({
      userId: "u",
      slug: "s",
      name: "Jane Doe",
      firstName: "Jane",
      nmlsId: "123456",
      licensedStates: ["CA", "NV"],
      disclosures: [],
    });
    assert.match(prompt, /Jane's AI assistant/);
    assert.match(prompt, /NMLS #123456/);
    assert.match(prompt, /CA, NV/);
    assert.match(prompt, /Never quote rates/);
  });
});
