import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateId } from "./id";
import type { ChatSessionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-free-tier-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { consumeFreeAction, freeActionsUsed, readDb, saveChatSession, saveWebsiteAutopilotChange } from "./db";
import { executeMloTool } from "./ai/cerebro-tools";
import { autopilotPreviewReply, countVisitorOfficerMessagesToday, FREE_DAILY_MESSAGE_LIMIT, noteAudience, runAssistantTurn } from "./ai/chat-agent";
import { generateWebsiteAutopilotPlan } from "./ai/website-autopilot";
import { FREE_DAILY_ACTIONS, FREE_VISITOR_DAILY_MESSAGES, utcDay } from "./free-tier";

function publicSession(overrides: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id: generateId("chat"),
    mode: "public_site",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
    capturedFields: {},
    status: "active",
    ...overrides,
  };
}

describe("free plan limits", () => {
  it("are the approved numbers", () => {
    assert.equal(FREE_DAILY_MESSAGE_LIMIT, 15);
    assert.equal(FREE_DAILY_ACTIONS, 1);
    assert.equal(FREE_VISITOR_DAILY_MESSAGES, 10);
  });

  it("consumeFreeAction allows one action per account per day", () => {
    const day = "2026-11-17";
    assert.equal(consumeFreeAction("user_free_1", day, 1), true);
    assert.equal(consumeFreeAction("user_free_1", day, 1), false);
    assert.equal(consumeFreeAction("user_free_2", day, 1), true);
    assert.equal(consumeFreeAction("user_free_1", "2026-11-18", 1), true);
    assert.equal(freeActionsUsed("user_free_1", day), 1);
  });
});

describe("free dashboard Cerebro", () => {
  it("does one real action a day end to end, then asks for the upgrade", async () => {
    const ctx = { userId: "user_free_drafts", paidPlan: false };
    const first = JSON.parse(
      await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "gmb_post", goal: "Open house Q&A" } }, ctx),
    );
    assert.equal(first.error, undefined);
    const second = JSON.parse(
      await executeMloTool({ toolName: "draft_landing_page", input: { goal: "book consultations" } }, ctx),
    );
    assert.equal(second.error, "upgrade_required");
    assert.equal(second.reason, "daily_action_used");
    assert.match(second.pricingUrl, /\/pricing$/);
  });

  it("never meters a paid plan", async () => {
    const ctx = { userId: "user_paid_drafts", paidPlan: true };
    for (let i = 0; i < 3; i++) {
      const out = JSON.parse(await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "social_post", goal: "Buyer tips" } }, ctx));
      assert.equal(out.error, undefined);
    }
    assert.equal(freeActionsUsed("user_paid_drafts", utcDay()), 0);
  });

  it("runs website autopilot as a preview that saves and applies nothing", async () => {
    const before = readDb().websiteAutopilotChanges.length;
    const out = JSON.parse(await executeMloTool({ toolName: "run_website_autopilot", input: {} }, { userId: "user_free_ap" }));
    assert.equal(out.preview, true);
    assert.equal(out.applied, 0);
    assert.ok(out.wouldChange.length > 0);
    assert.equal(readDb().websiteAutopilotChanges.length, before);
    assert.equal(readDb().autopilotRuns.some((run) => run.userId === "user_free_ap"), false);
  });

  it("keeps applying website changes paid-only", async () => {
    const plan = generateWebsiteAutopilotPlan({ userId: "user_free_decide", pageType: "profile", leadGoal: "all" });
    const change = { ...plan.changes[0], userId: "user_free_decide", status: "needs_approval" as const };
    saveWebsiteAutopilotChange(change);
    const out = JSON.parse(
      await executeMloTool({ toolName: "decide_website_change", input: { changeId: change.id, decision: "approve" } }, { userId: "user_free_decide" }),
    );
    assert.equal(out.error, "upgrade_required");
    assert.equal(out.reason, "paid_only");
  });

  it("the 'run autopilot' command shows a preview on Free and changes nothing", async () => {
    const before = readDb().websiteAutopilotChanges.filter((c) => c.userId === "user_free_cmd").length;
    const result = await runAssistantTurn({ mode: "mlo_dashboard", userId: "user_free_cmd", userMessage: "run website autopilot" });
    assert.match(result.reply, /^Autopilot preview/);
    assert.match(result.reply, /Nothing was changed/);
    assert.equal(result.autopilot?.autoAppliedCount, 0);
    assert.equal(readDb().websiteAutopilotChanges.filter((c) => c.userId === "user_free_cmd").length, before);
    assert.match(autopilotPreviewReply({ ...generateWebsiteAutopilotPlan({ pageType: "profile", leadGoal: "all" }), changes: [] }), /looks good/);
  });
});

describe("public site visitor cap", () => {
  it("labels chats from the tools Cerebro uses, and a homebuyer signal always wins", () => {
    const s = publicSession();
    noteAudience(s, "create_starter_kit");
    assert.equal(s.audience, "officer");
    noteAudience(s, "capture_lead_qualification");
    assert.equal(s.audience, "borrower");
    noteAudience(s, "get_pricing");
    assert.equal(s.audience, "borrower");
  });

  it("counts only this device's loan-officer chats today", () => {
    const today = utcDay();
    saveChatSession(publicSession({ visitorKey: "dev_a", audience: "officer", usageDay: today, usageCount: 6 }));
    saveChatSession(publicSession({ visitorKey: "dev_a", audience: "officer", usageDay: today, usageCount: 4 }));
    saveChatSession(publicSession({ visitorKey: "dev_a", audience: "borrower", usageDay: today, usageCount: 25 }));
    saveChatSession(publicSession({ visitorKey: "dev_a", usageDay: today, usageCount: 3 }));
    saveChatSession(publicSession({ visitorKey: "dev_b", audience: "officer", usageDay: today, usageCount: 9 }));
    saveChatSession(publicSession({ visitorKey: "dev_a", audience: "officer", usageDay: "2020-01-01", usageCount: 9 }));
    assert.equal(countVisitorOfficerMessagesToday("dev_a"), 10);
    assert.equal(countVisitorOfficerMessagesToday("dev_b"), 9);
  });

  it("stops a capped loan officer's public chat with a sign-up line, but never a homebuyer's", async () => {
    const today = utcDay();
    const officerChat = publicSession({ visitorKey: "dev_cap", audience: "officer", usageDay: today, usageCount: FREE_VISITOR_DAILY_MESSAGES });
    saveChatSession(officerChat);
    const capped = await runAssistantTurn({ mode: "public_site", sessionId: officerChat.id, visitorKey: "dev_cap", userMessage: "write my GBP post" });
    assert.equal((capped as { limitReached?: boolean }).limitReached, true);
    assert.match(capped.reply, /free Cerebro chat/);

    const buyerChat = publicSession({ visitorKey: "dev_cap", audience: "borrower" });
    saveChatSession(buyerChat);
    const buyer = await runAssistantTurn({ mode: "public_site", sessionId: buyerChat.id, visitorKey: "dev_cap", userMessage: "I want to buy a home" });
    assert.notEqual((buyer as { limitReached?: boolean }).limitReached, true);
  });
});
