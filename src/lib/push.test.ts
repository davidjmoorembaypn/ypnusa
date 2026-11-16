import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { BorrowerLeadRecord, PushSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-push-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
for (const key of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "AI_PROVIDER", "GEMINI_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
  delete process.env[key];
}

const OFFICER = "acct_officer";
const SUB = { endpoint: "https://push.example.com/abc", keys: { p256dh: "BPubKey_abc-123", auth: "authSecret_1" } };

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("phone alerts (web push)", async () => {
  const { writeDb, readDb, secretsDir } = await import("./db");
  const push = await import("./push");
  const { notifyAssignedOfficer } = await import("./notifications");
  const { runAssistantTurn } = await import("./ai/chat-agent");

  const sent: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  let failWith: number | null = null;

  beforeEach(() => {
    sent.length = 0;
    failWith = null;
    push.setPushSenderForTests(async (subscription: PushSubscriptionRecord, payload: string) => {
      if (failWith) throw Object.assign(new Error("push failed"), { statusCode: failWith });
      sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
      return { statusCode: 201 };
    });
    writeDb((db) => {
      db.pushSubscriptions = [];
      db.loAlerts = [];
      db.chatSessions = [];
    });
  });

  after(() => {
    push.setPushSenderForTests(null);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("creates the VAPID key pair once, in a private file, and reuses it", () => {
    push.resetPushKeysForTests();
    const first = push.vapidKeys();
    const file = path.join(secretsDir(), "vapid-keys.json");
    assert.ok(fs.existsSync(file));
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    push.resetPushKeysForTests();
    assert.deepEqual(push.vapidKeys(), first);
  });

  it("accepts only https endpoints with sane keys", () => {
    assert.equal(push.saveSubscription(OFFICER, { ...SUB, endpoint: "http://push.example.com/x" }).ok, false);
    assert.equal(push.saveSubscription(OFFICER, { ...SUB, keys: { p256dh: "<script>", auth: "x" } }).ok, false);
    assert.equal(push.saveSubscription(OFFICER, null).ok, false);
    assert.equal(push.saveSubscription(OFFICER, SUB).ok, true);
    assert.equal(push.hasSubscription(OFFICER), true);
  });

  it("moves a re-used endpoint to the new account instead of duplicating it", () => {
    push.saveSubscription(OFFICER, SUB);
    push.saveSubscription("acct_other", SUB);
    const subs = readDb().pushSubscriptions;
    assert.equal(subs.length, 1);
    assert.equal(subs[0].userId, "acct_other");
  });

  it("removes only the officer's own subscription", () => {
    push.saveSubscription(OFFICER, SUB);
    push.removeSubscription("acct_other", SUB.endpoint);
    assert.equal(push.hasSubscription(OFFICER), true);
    push.removeSubscription(OFFICER, SUB.endpoint);
    assert.equal(push.hasSubscription(OFFICER), false);
  });

  it("drops subscriptions the push service says are gone", async () => {
    push.saveSubscription(OFFICER, SUB);
    failWith = 410;
    const delivered = await push.sendPushToUser(OFFICER, { title: "t", body: "b", url: "/x" });
    assert.equal(delivered, 0);
    assert.equal(push.hasSubscription(OFFICER), false);
  });

  it("only ever opens same-site paths", async () => {
    push.saveSubscription(OFFICER, SUB);
    await push.sendPushToUser(OFFICER, { title: "t", body: "b", url: "https://evil.example.com/" });
    await push.sendPushToUser(OFFICER, { title: "t", body: "b", url: "//evil.example.com/" });
    assert.deepEqual(sent.map((item) => item.payload.url), ["/", "/"]);
  });

  it("alerts the officer of a new lead without any borrower details", async () => {
    push.saveSubscription(OFFICER, SUB);
    const lead: BorrowerLeadRecord = {
      id: "lead_push_1",
      createdAt: new Date().toISOString(),
      answers: {
        loanProgram: "FHA",
        name: "Sam Rivera",
        email: "sam.rivera@example.com",
        phone: "5595550199",
        zip: "93277",
        contactConsent: true,
        timeline: "lt_30",
      },
      qualification: {
        programScores: { overallScore: 80 },
        leadQuality: "strong",
        urgency: "critical",
        recommendedNextStep: "Call today.",
        rationale: [],
      },
      assignedLoId: OFFICER,
      crmLeadId: "crm_push_1",
    };
    writeDb((db) => {
      db.borrowerLeads = [lead];
    });
    notifyAssignedOfficer({ loId: OFFICER, borrowerLeadId: lead.id, loanProgram: "FHA", answers: lead.answers, qualification: lead.qualification });
    await settle();
    assert.equal(sent.length, 1);
    const text = JSON.stringify(sent[0].payload);
    for (const secret of ["Sam", "Rivera", "sam.rivera", "5595550199", "93277"]) {
      assert.ok(!text.includes(secret), `alert must not contain ${secret}`);
    }
    assert.match(String(sent[0].payload.title), /New (hot )?lead/);
    assert.equal(sent[0].payload.url, "/portal/nurture");

    notifyAssignedOfficer({ loId: OFFICER, borrowerLeadId: lead.id, loanProgram: "FHA", answers: lead.answers, qualification: lead.qualification });
    await settle();
    assert.equal(sent.at(-1)!.payload.title, "A lead needs you");
  });

  it("alerts the officer once when a borrower starts a chat on their page", async () => {
    push.saveSubscription(OFFICER, SUB);
    writeDb((db) => {
      db.chatSessions = [
        {
          id: "chat_push",
          mode: "lead_qualification",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          officerUserId: OFFICER,
          officerSlug: "jane-doe-abc",
          messages: [],
          capturedFields: {},
          status: "active",
        },
      ];
    });
    await runAssistantTurn({ mode: "lead_qualification", sessionId: "chat_push", userMessage: "Hello" });
    await settle();
    await runAssistantTurn({ mode: "lead_qualification", sessionId: "chat_push", userMessage: "Are you there?" });
    await settle();
    const chatAlerts = sent.filter((item) => item.payload.title === "New chat on your page");
    assert.equal(chatAlerts.length, 1);
    assert.equal(chatAlerts[0].payload.url, "/portal/live-chats");
    assert.ok(!JSON.stringify(chatAlerts[0].payload).includes("Hello"));
  });
});
