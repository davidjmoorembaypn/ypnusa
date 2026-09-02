import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { generateWebsiteAutopilotPlan, runWebsiteAutopilot } from "./website-autopilot";
import { listWebsiteAutopilotChanges } from "../db";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-website-autopilot-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const BASE_INPUT = {
  userId: "user_lo_1",
  pageType: "profile" as const,
  currentCopy: "Welcome to our mortgage page.",
  targetAudience: "first-time buyers",
  marketCity: "Dallas",
  marketState: "TX",
  leadGoal: "buyer" as const,
  existingSeoTitle: "Home",
  existingMetaDescription: "A mortgage page.",
  currentChatbotIntro: "Hi there.",
};

describe("generateWebsiteAutopilotPlan — pure planning, no side effects", () => {
  it("auto-applies low-risk improvements when grounding text is present", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const headline = plan.changes.find((c) => c.changeType === "headline");
    assert.ok(headline);
    assert.equal(headline?.riskLevel, "low");
    assert.equal(headline?.status, "auto_applied");
    assert.equal(headline?.autoApplied, true);
    assert.equal(headline?.requiresApproval, false);
    assert.ok(plan.autoAppliedCount > 0);
  });

  it("flags compliance-sensitive existing copy as needs_approval, never auto-applying it", () => {
    const plan = generateWebsiteAutopilotPlan({
      ...BASE_INPUT,
      currentCopy: "Guaranteed low rates and pre-approval in minutes!",
    });
    const disclosure = plan.changes.find((c) => c.changeType === "compliance_disclosure");
    assert.ok(disclosure);
    assert.equal(disclosure?.riskLevel, "high");
    assert.equal(disclosure?.status, "needs_approval");
    assert.equal(disclosure?.autoApplied, false);
    assert.equal(disclosure?.requiresApproval, true);
    assert.ok(plan.needsApprovalCount > 0);
  });

  it("includes headline, CTA, SEO, chatbot, and lead-form change types in the plan", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const types = plan.changes.map((c) => c.changeType);
    assert.ok(types.includes("headline"));
    assert.ok(types.includes("cta"));
    assert.ok(types.includes("seo_title"));
    assert.ok(types.includes("seo_meta_description"));
    assert.ok(types.includes("chatbot_greeting"));
    assert.ok(types.includes("lead_form_helper_text"));
  });

  it("produces a simple, done-for-you MLO summary requiring no manual work when nothing needs review", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    assert.equal(plan.needsApprovalCount, 0);
    assert.match(plan.summaryForMlo, /Dallas/);
    assert.match(plan.summaryForMlo, /No manual work is required/);
    assert.equal(plan.safeToShowMloSummary, true);
  });

  it("never marks a rate/APR/guarantee/license-touching change as auto_applied", () => {
    const plan = generateWebsiteAutopilotPlan({
      ...BASE_INPUT,
      currentCopy: "Guaranteed low rates and pre-approval in minutes!",
    });
    for (const change of plan.changes) {
      if (/rate|guarantee|approv|nmls|licens/i.test(change.afterText)) {
        assert.notEqual(change.status, "auto_applied");
      }
    }
  });

  it("does not perform any live publishing, deployment, or external network action", () => {
    // generateWebsiteAutopilotPlan is pure — asserting it returns synchronously
    // (no Promise) is a proxy for "no network/IO occurred" in this deterministic planner.
    const result = generateWebsiteAutopilotPlan(BASE_INPUT);
    assert.equal(result instanceof Promise, false);
    assert.ok(!("liveUrl" in result));
    assert.equal(result.changes.every((c) => c.status !== "auto_applied" || c.riskLevel === "low"), true);
  });
});

describe("runWebsiteAutopilot — persistence wrapper", () => {
  it("persists every generated change tagged with the userId", () => {
    const plan = runWebsiteAutopilot(BASE_INPUT);
    const stored = listWebsiteAutopilotChanges("user_lo_1");
    assert.equal(stored.length, plan.changes.length);
    assert.ok(stored.every((c) => c.userId === "user_lo_1"));
  });
});
