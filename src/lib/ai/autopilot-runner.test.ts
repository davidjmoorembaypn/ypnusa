import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, describe, it } from "node:test";
import {
  applyAutoApplyGate,
  getConfiguredAutopilotTargets,
  getWebsiteAutopilotRunnerConfig,
  runWebsiteAutopilotForConfiguredSites,
} from "./autopilot-runner";
import { generateWebsiteAutopilotPlan } from "./website-autopilot";
import { listAutopilotRuns } from "../db";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-autopilot-runner-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const FLAGS = [
  "WEBSITE_AUTOPILOT_UNATTENDED_ENABLED",
  "WEBSITE_AUTOPILOT_AUTO_APPLY_LOW_RISK",
  "WORDPRESS_AUTOPILOT_ENABLED",
] as const;

afterEach(() => {
  for (const flag of FLAGS) delete process.env[flag];
});

after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("getWebsiteAutopilotRunnerConfig — defaults", () => {
  it("defaults both flags to false when unset", () => {
    const config = getWebsiteAutopilotRunnerConfig();
    assert.equal(config.unattendedEnabled, false);
    assert.equal(config.autoApplyLowRisk, false);
  });
});

describe("runWebsiteAutopilotForConfiguredSites — disabled by default", () => {
  it("does nothing safely: no plan, no persisted run, no WordPress call", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("runWebsiteAutopilotForConfiguredSites must never call fetch while disabled");
    }) as typeof fetch;
    try {
      const result = runWebsiteAutopilotForConfiguredSites();
      assert.equal(result.ran, false);
      assert.equal(result.unattendedEnabled, false);
      assert.equal(result.targetsChecked, 0);
      assert.equal(result.totalChangeCount, 0);
      assert.equal(result.runIds.length, 0);
      assert.match(result.summary, /disabled/i);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("persists nothing to the run history store", () => {
    runWebsiteAutopilotForConfiguredSites();
    assert.equal(listAutopilotRuns().length, 0);
  });
});

describe("runWebsiteAutopilotForConfiguredSites — enabled, dry-run only", () => {
  it("creates and logs a run for each configured target, never calling WordPress", () => {
    process.env.WEBSITE_AUTOPILOT_UNATTENDED_ENABLED = "true";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("runWebsiteAutopilotForConfiguredSites must never call fetch, even when enabled");
    }) as typeof fetch;

    try {
      const result = runWebsiteAutopilotForConfiguredSites();
      const targets = getConfiguredAutopilotTargets();

      assert.equal(result.ran, true);
      assert.equal(result.dryRun, true);
      assert.equal(result.wordpressLive, false);
      assert.equal(result.targetsChecked, targets.length);
      assert.ok(result.totalChangeCount > 0);
      assert.equal(result.runIds.length, targets.length);
      assert.match(result.summary, /YPNUS checked your website/);

      const stored = listAutopilotRuns();
      assert.equal(stored.length, targets.length);
      assert.ok(stored.every((run) => run.dryRun === true));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("never reports wordpressLive: true unless WORDPRESS_AUTOPILOT_ENABLED is set", () => {
    process.env.WEBSITE_AUTOPILOT_UNATTENDED_ENABLED = "true";
    process.env.WORDPRESS_AUTOPILOT_ENABLED = "true";
    const result = runWebsiteAutopilotForConfiguredSites();
    assert.equal(result.wordpressLive, true);
    assert.equal(result.dryRun, true, "still never a live write — dryRun stays true regardless");
  });
});

describe("applyAutoApplyGate — low-risk auto-apply is opt-in for the unattended runner", () => {
  const target = getConfiguredAutopilotTargets()[0];

  it("downgrades every auto_applied change to proposed when the flag is off", () => {
    const plan = generateWebsiteAutopilotPlan(target.planInput);
    assert.ok(plan.autoAppliedCount > 0, "fixture target should produce at least one auto-applied change");

    const gated = applyAutoApplyGate(plan, false);
    assert.equal(gated.autoAppliedCount, 0);
    assert.ok(gated.changes.every((c) => c.status !== "auto_applied"));
  });

  it("leaves auto_applied changes untouched when the flag is on", () => {
    const plan = generateWebsiteAutopilotPlan(target.planInput);
    const gated = applyAutoApplyGate(plan, true);
    assert.equal(gated.autoAppliedCount, plan.autoAppliedCount);
  });

  it("never downgrades a needs_approval (high/medium-risk) change", () => {
    const plan = generateWebsiteAutopilotPlan({
      ...target.planInput,
      currentCopy: "Guaranteed low rates and pre-approval in minutes!",
    });
    assert.ok(plan.needsApprovalCount > 0);
    const gated = applyAutoApplyGate(plan, false);
    assert.equal(gated.needsApprovalCount, plan.needsApprovalCount);
    assert.ok(gated.changes.some((c) => c.status === "needs_approval"));
  });
});

describe("runWebsiteAutopilotForConfiguredSites — WEBSITE_AUTOPILOT_AUTO_APPLY_LOW_RISK gate end-to-end", () => {
  it("logs zero auto-applied changes when the flag is off", () => {
    process.env.WEBSITE_AUTOPILOT_UNATTENDED_ENABLED = "true";
    const result = runWebsiteAutopilotForConfiguredSites();
    assert.equal(result.autoAppliedCount, 0);
  });

  it("logs the plan's natural auto-applied count when the flag is on", () => {
    process.env.WEBSITE_AUTOPILOT_UNATTENDED_ENABLED = "true";
    process.env.WEBSITE_AUTOPILOT_AUTO_APPLY_LOW_RISK = "true";
    const result = runWebsiteAutopilotForConfiguredSites();
    assert.ok(result.autoAppliedCount > 0);
  });
});
