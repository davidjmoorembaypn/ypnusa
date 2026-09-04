import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import type { ChatSessionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-chat-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

// Simulate an on-disk snapshot written before chatSessions existed (an older
// store.json). This file must be in place BEFORE db.ts's first hydrate()
// call in this process, because db.ts hydrates from disk exactly once and
// caches the result at module scope (`memoryDb`) for the rest of the
// process's lifetime — there's no exported way to force a re-hydrate. That's
// fine here because node's test runner gives each test file its own process,
// so this is genuinely the first thing touching the store in this process,
// and the very first "it" below is what exercises it.
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "store.json"), JSON.stringify({ demoRequests: [] }));

function chatSession(id: string, overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id,
    mode: "public_site",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    capturedFields: {},
    status: "active",
    ...overrides,
  };
}

describe("chat session persistence (db.ts)", async () => {
  const { readDb, readChatSession, saveChatSession } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("hydrates a legacy snapshot with no chatSessions key to an empty array", () => {
    // Exercises normalize()'s arrayOrEmpty fallback for chatSessions on a
    // pre-feature snapshot, rather than throwing.
    assert.deepEqual(readDb().chatSessions, []);
  });

  it("appends a brand-new session, and readChatSession reads back an equal record", () => {
    const session = chatSession("chat_new_1", {
      messages: [{ id: "msg_1", role: "user", content: "hello", createdAt: new Date().toISOString() }],
    });

    saveChatSession(session);

    const stored = readChatSession("chat_new_1");
    assert.deepEqual(stored, session);
  });

  it("upserts on a repeat save with the same id instead of duplicating", () => {
    const countBefore = readDb().chatSessions.length;

    const updated = chatSession("chat_new_1", {
      status: "qualified",
      capturedFields: { name: "Jamie Rivera", consent: true },
    });
    saveChatSession(updated);

    const db = readDb();
    assert.equal(db.chatSessions.length, countBefore);

    const stored = readChatSession("chat_new_1");
    assert.equal(stored?.status, "qualified");
    assert.equal(stored?.capturedFields.name, "Jamie Rivera");
    assert.equal(stored?.capturedFields.consent, true);
  });

  it("returns null from readChatSession for an id that was never saved", () => {
    assert.equal(readChatSession("chat_never_saved"), null);
  });
});
