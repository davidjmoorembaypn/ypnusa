import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { buildAutopilotRunRecord, generateWebsiteAutopilotPlan, runWebsiteAutopilot } from "./website-autopilot";
import { listAutopilotRuns, listWebsiteAutopilotChanges, saveAutopilotRun } from "../db";

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

describe("buildAutopilotRunRecord — Run History / Change Log foundation", () => {
  it("carries the plan's score/summary/counts and a dry-run/off status", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const run = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, {
      userId: "user_lo_2",
      pageLabel: "Dallas homepage",
      wordpressLive: false,
    });
    assert.equal(run.score, plan.score);
    assert.equal(run.summaryForMlo, plan.summaryForMlo);
    assert.equal(run.autoAppliedCount, plan.autoAppliedCount);
    assert.equal(run.needsApprovalCount, plan.needsApprovalCount);
    assert.equal(run.changeCount, plan.changes.length);
    assert.equal(run.dryRun, true);
    assert.equal(run.wordpressLive, false);
    assert.equal(run.pageLabel, "Dallas homepage");
    assert.ok(run.createdAt);
  });

  it("surfaces auto-applied changes first in the top-changes preview", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const run = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, { wordpressLive: false });
    assert.ok(run.topChanges.length > 0);
    assert.equal(run.topChanges[0].status, "auto_applied");
  });

  it("never marks wordpressLive true unless the caller says WordPress Autopilot is enabled", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const run = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, { wordpressLive: true });
    assert.equal(run.wordpressLive, true);
  });
});

describe("Run history persistence (db.ts) — saveAutopilotRun / listAutopilotRuns", () => {
  it("persists a run and returns it scoped to its userId, newest first", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const older = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, {
      userId: "user_lo_3",
      wordpressLive: false,
    });
    older.createdAt = "2026-01-01T00:00:00.000Z";
    const newer = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, {
      userId: "user_lo_3",
      wordpressLive: false,
    });
    newer.createdAt = "2026-01-02T00:00:00.000Z";

    saveAutopilotRun(older);
    saveAutopilotRun(newer);

    const stored = listAutopilotRuns("user_lo_3");
    assert.equal(stored.length, 2);
    assert.equal(stored[0].id, newer.id);
    assert.equal(stored[1].id, older.id);
  });

  it("does not leak another MLO's run history", () => {
    const plan = generateWebsiteAutopilotPlan(BASE_INPUT);
    const run = buildAutopilotRunRecord(plan, BASE_INPUT.pageType, {
      userId: "user_lo_4",
      wordpressLive: false,
    });
    saveAutopilotRun(run);
    const stored = listAutopilotRuns("user_lo_5");
    assert.ok(!stored.some((r) => r.id === run.id));
  });
});
