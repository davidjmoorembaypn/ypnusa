import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { generateId } from "../id";
import type { ChatSessionRecord, LoanOfficerRecord, WebsiteAutopilotChange } from "../types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-cerebro-tools-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { runWithTools } from "./chat-agent";
import { executeMloTool } from "./cerebro-tools";
import type { AiGenerateResult, AiProvider } from "./provider";
import { generateWebsiteAutopilotPlan } from "./website-autopilot";
import { listWebsiteAutopilotChanges, saveWebsiteAutopilotChange, writeDb } from "../db";

function heldChange(userId: string, overrides: Partial<WebsiteAutopilotChange> = {}): WebsiteAutopilotChange {
  const now = new Date().toISOString();
  return {
    id: generateId("autopilot"),
    userId,
    pageType: "profile",
    changeType: "headline",
    title: "Strengthen headline",
    afterText: "Local guidance for buyers.",
    reason: "test",
    expectedBenefit: "test",
    riskLevel: "medium",
    status: "needs_approval",
    autoApplied: false,
    requiresApproval: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function session(mode: ChatSessionRecord["mode"], userId?: string): ChatSessionRecord {
  return {
    id: generateId("chat"),
    mode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
    messages: [],
    capturedFields: {},
    status: "active",
  };
}

describe("autopilot autonomy levels", () => {
  const base = { pageType: "profile" as const, currentCopy: "Welcome to my page", marketCity: "Fresno", marketState: "CA" };

  it("approval_first holds every change", () => {
    const plan = generateWebsiteAutopilotPlan({ ...base, autonomy: "approval_first" });
    assert.ok(plan.changes.length > 0);
    assert.ok(plan.changes.every((c) => c.status === "needs_approval"));
  });

  it("autonomous_with_guardrails applies low-risk changes even without existing copy", () => {
    const plan = generateWebsiteAutopilotPlan({ pageType: "profile", autonomy: "autonomous_with_guardrails" });
    assert.ok(plan.changes.some((c) => c.status === "auto_applied"));
  });

  it("never auto-applies high-risk or compliance-language changes, at any autonomy", () => {
    const plan = generateWebsiteAutopilotPlan({
      ...base,
      autonomy: "autonomous_with_guardrails",
      currentChatbotIntro: "old",
      existingSeoTitle: "old",
    });
    for (const change of plan.changes) {
      if (change.riskLevel === "high") assert.notEqual(change.status, "auto_applied", change.title);
      if (/\brates?\b|\bapr\b|guarantee|approv|nmls|licens/i.test(change.afterText)) {
        assert.notEqual(change.status, "auto_applied", change.title);
      }
    }
  });

  it("omitting autonomy keeps the historical behavior (ungrounded changes are only proposed)", () => {
    const plan = generateWebsiteAutopilotPlan({ pageType: "profile" });
    assert.ok(plan.changes.every((c) => c.status !== "auto_applied" || Boolean(c.beforeText)));
  });
});

describe("executeMloTool", () => {
  it("decide_website_change only touches the caller's own pending changes", async () => {
    const mine = heldChange("user_a");
    const theirs = heldChange("user_b");
    saveWebsiteAutopilotChange(mine);
    saveWebsiteAutopilotChange(theirs);

    const denied = JSON.parse(
      await executeMloTool({ toolName: "decide_website_change", input: { changeId: theirs.id, decision: "approve" } }, { userId: "user_a", paidPlan: true }),
    );
    assert.equal(denied.error, "change_not_found");
    assert.equal(listWebsiteAutopilotChanges("user_b").find((c) => c.id === theirs.id)?.status, "needs_approval");

    const ok = JSON.parse(
      await executeMloTool({ toolName: "decide_website_change", input: { changeId: mine.id, decision: "approve" } }, { userId: "user_a", paidPlan: true }),
    );
    assert.equal(ok.ok, true);
    assert.equal(listWebsiteAutopilotChanges("user_a").find((c) => c.id === mine.id)?.status, "auto_applied");

    const again = JSON.parse(
      await executeMloTool({ toolName: "decide_website_change", input: { changeId: mine.id, decision: "reject" } }, { userId: "user_a", paidPlan: true }),
    );
    assert.equal(again.error, "not_pending");
  });

  it("list_pending_website_changes shows only the caller's held changes", async () => {
    const mine = heldChange("user_c");
    saveWebsiteAutopilotChange(mine);
    saveWebsiteAutopilotChange(heldChange("user_d"));
    const result = JSON.parse(await executeMloTool({ toolName: "list_pending_website_changes", input: {} }, { userId: "user_c", paidPlan: true }));
    assert.deepEqual(
      result.pending.map((c: { id: string }) => c.id),
      [mine.id],
    );
  });

  it("get_my_pipeline returns only leads assigned to the officer matching the signed-in email", async () => {
    const officer: LoanOfficerRecord = {
      id: "lo_test_1",
      name: "Test Officer",
      email: "Officer@Example.com",
      specialties: ["CONVENTIONAL"],
      weeklyWindows: [],
    };
    const qualification = {
      programScores: {},
      leadQuality: "strong" as const,
      urgency: "high" as const,
      recommendedNextStep: "Call today",
      rationale: [],
    };
    writeDb((db) => {
      db.loanOfficers.push(officer);
      db.borrowerLeads.push(
        {
          id: "bl_mine",
          createdAt: new Date().toISOString(),
          answers: { loanProgram: "CONVENTIONAL", name: "Pat Buyer", contactConsent: true },
          qualification,
          assignedLoId: officer.id,
          crmLeadId: "crm_mine",
        },
        {
          id: "bl_other",
          createdAt: new Date().toISOString(),
          answers: { loanProgram: "CONVENTIONAL", name: "Someone Else" },
          qualification,
          assignedLoId: "lo_someone_else",
          crmLeadId: "crm_other",
        },
      );
    });
    const result = JSON.parse(
      await executeMloTool({ toolName: "get_my_pipeline", input: {} }, { userId: "user_e", userEmail: "officer@example.com", paidPlan: true }),
    );
    assert.deepEqual(
      result.leads.map((l: { name: string }) => l.name),
      ["Pat Buyer"],
    );

    const none = JSON.parse(await executeMloTool({ toolName: "get_my_pipeline", input: {} }, { userId: "user_f", userEmail: "nobody@example.com", paidPlan: true }));
    assert.equal(none.error, "no_officer_profile");
  });

  it("draft tools return drafts flagged as not sent or published", async () => {
    const post = JSON.parse(
      await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "social_post", goal: "Invite first-time buyers to a free Q&A" } }, { paidPlan: true }),
    );
    assert.equal(post.draftOnly, true);
    const page = JSON.parse(
      await executeMloTool({ toolName: "draft_landing_page", input: { goal: "book consultations", offer: "free home buying plan" } }, { paidPlan: true }),
    );
    assert.equal(page.draftOnly, true);
  });

  it("adds the officer's license disclosures to social posts, ads and Google posts", async () => {
    writeDb((db) => {
      db.loanOfficers.push({
        id: "lo_disclose",
        name: "Dana Diaz",
        email: "dana@example.com",
        nmlsId: "555111",
        company: "Valley Home Loans",
        companyNmlsId: "999000",
        licenses: [{ state: "CA", type: "ca_dre", number: "01234567" }],
        specialties: ["FHA"],
        weeklyWindows: [],
      });
    });
    const ctx = { userId: "user_dana", userEmail: "dana@example.com", paidPlan: true };
    const post = JSON.parse(
      await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "social_post", goal: "Invite first-time buyers to a free Q&A" } }, ctx),
    );
    assert.match(post.result.body, /Dana Diaz, NMLS #555111/);
    assert.match(post.result.body, /Valley Home Loans, NMLS #999000/);
    assert.match(post.result.body, /Licensed in CA/);
    assert.match(post.result.body, /Equal Housing Opportunity/);
    assert.ok(post.disclosuresAdded.length >= 4);

    const ad = JSON.parse(await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "ad_copy", goal: "Refinance checkups" } }, ctx));
    assert.match(ad.result.primaryText, /NMLS #555111/);
    const gmb = JSON.parse(await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "gmb_post", goal: "Open house Q&A" } }, ctx));
    assert.match(gmb.result.postText, /NMLS #555111/);
    const description = JSON.parse(await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "gmb_description", goal: "Profile" } }, ctx));
    assert.equal(description.disclosuresAdded, undefined, "a business description is not an ad");
  });

  it("lists what to add when no officer profile is linked, and fills a placeholder for a missing NMLS ID", async () => {
    const anonymous = JSON.parse(
      await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "social_post", goal: "Buyer tips" } }, { userEmail: "nobody@example.com", paidPlan: true }),
    );
    assert.ok(anonymous.disclosuresNeeded.length > 0);
    writeDb((db) => {
      db.loanOfficers.push({ id: "lo_no_nmls", name: "Nia North", email: "nia@example.com", specialties: ["FHA"], weeklyWindows: [] });
    });
    const missing = JSON.parse(
      await executeMloTool({ toolName: "draft_marketing_content", input: { kind: "social_post", goal: "Buyer tips" } }, { userEmail: "nia@example.com", paidPlan: true }),
    );
    assert.match(missing.result.body, /Nia North, NMLS #\[add your NMLS ID\]/);
    assert.ok(missing.disclosureNote);
  });
});

describe("MLO tools are unreachable from a public session", () => {
  it("runWithTools refuses an mlo tool call when the session is not mlo_dashboard", async () => {
    const outputs: string[] = [];
    let calls = 0;
    const provider: AiProvider = {
      name: "fake",
      async generate(request): Promise<AiGenerateResult> {
        calls++;
        if (calls === 1) {
          return { text: "", stopReason: "tool_use", toolCalls: [{ toolName: "get_my_pipeline", input: {} }] };
        }
        const last = request.messages[request.messages.length - 1];
        outputs.push(last.content);
        return { text: "done", toolCalls: [], stopReason: "end_turn" };
      },
    };
    await runWithTools(provider, "sys", [{ role: "user", content: "hi" }], [], session("public_site"), () => {}, {
      userId: "attacker",
      userEmail: "officer@example.com",
    });
    assert.match(outputs[0], /not_available/);
  });
});

it("builds a page draft for the requested audience and sections", async () => {
  const result = JSON.parse(await executeMloTool({
    toolName: "draft_landing_page",
    input: { goal: "prepare buyers for closing", offer: "closing checklist", audience: "Fresno homebuyers", sections: ["hero", "closing checklist", "faq"] },
  }, { paidPlan: true }));
  assert.equal(result.draftOnly, true);
  assert.equal(result.offer, "closing checklist");
  assert.equal(result.page.audience, "Fresno homebuyers");
  assert.deepEqual(result.page.sections.map((section: { id: string }) => section.id), ["hero", "closing checklist", "faq"]);
});
