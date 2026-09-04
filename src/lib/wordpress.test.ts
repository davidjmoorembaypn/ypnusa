import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import {
  applyWordPressAutopilotPlan,
  classifyWordPressChangeRisk,
  conditionallyUpdateWordPressContent,
  fetchWordPressContent,
  getWordPressAutopilotStatus,
  prepareWordPressUpdatePayload,
} from "./wordpress";
import type { WebsiteAutopilotChange } from "@/lib/types";
import type { WebsiteAutopilotPlan } from "@/lib/ai/website-autopilot";

const WORDPRESS_ENV_VARS = [
  "WORDPRESS_SITE_URL",
  "WORDPRESS_AUTOPILOT_USERNAME",
  "WORDPRESS_AUTOPILOT_APP_PASSWORD",
  "WORDPRESS_AUTOPILOT_ENABLED",
  "WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK",
] as const;

let savedEnv: Record<string, string | undefined> = {};

function clearWordPressEnv() {
  for (const name of WORDPRESS_ENV_VARS) delete process.env[name];
}

before(() => {
  savedEnv = Object.fromEntries(WORDPRESS_ENV_VARS.map((name) => [name, process.env[name]]));
  clearWordPressEnv();
});

after(() => {
  for (const name of WORDPRESS_ENV_VARS) {
    const value = savedEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

let originalFetch: typeof globalThis.fetch;

function makeChange(overrides: Partial<WebsiteAutopilotChange>): WebsiteAutopilotChange {
  const now = new Date().toISOString();
  return {
    id: "autopilot_test",
    pageType: "profile",
    changeType: "headline",
    title: "Test change",
    afterText: "Some copy",
    reason: "test",
    expectedBenefit: "test",
    riskLevel: "low",
    status: "proposed",
    autoApplied: false,
    requiresApproval: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("wordpress.ts — safe env handling (no WORDPRESS_* configured)", () => {
  before(() => {
    clearWordPressEnv();
  });

  it("getWordPressAutopilotStatus reports unconfigured and lists missing var names, never values", () => {
    const status = getWordPressAutopilotStatus();
    assert.equal(status.configured, false);
    assert.equal(status.enabled, false);
    assert.equal(status.autoApplyLowRisk, false);
    assert.ok(status.missingEnvVars.includes("WORDPRESS_SITE_URL"));
    assert.ok(status.missingEnvVars.includes("WORDPRESS_AUTOPILOT_USERNAME"));
    assert.ok(status.missingEnvVars.includes("WORDPRESS_AUTOPILOT_APP_PASSWORD"));
  });

  it("fetchWordPressContent resolves to null when unconfigured", async () => {
    const result = await fetchWordPressContent({ id: 1 });
    assert.equal(result, null);
  });

  it("conditionallyUpdateWordPressContent resolves to applied:false when unconfigured", async () => {
    const result = await conditionallyUpdateWordPressContent({ id: 1 }, { afterText: "x" });
    assert.equal(result.applied, false);
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
  });
});

describe("wordpress.ts — zero external network calls with env unset", () => {
  before(() => {
    clearWordPressEnv();
    originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("unexpected network call");
    }) as unknown as typeof globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetchWordPressContent never calls fetch when required env vars are missing", async () => {
    const result = await fetchWordPressContent({ id: 42 });
    assert.equal(result, null);
  });

  it("fetchWordPressContent never calls fetch when neither id nor slug is given (even if configured)", async () => {
    process.env.WORDPRESS_SITE_URL = "https://ypnus.com";
    process.env.WORDPRESS_AUTOPILOT_USERNAME = "autopilot";
    process.env.WORDPRESS_AUTOPILOT_APP_PASSWORD = "secret";
    try {
      const result = await fetchWordPressContent({});
      assert.equal(result, null);
    } finally {
      clearWordPressEnv();
    }
  });

  it("conditionallyUpdateWordPressContent never calls fetch when required env vars are missing", async () => {
    const result = await conditionallyUpdateWordPressContent({ id: 1 }, { afterText: "x" });
    assert.equal(result.applied, false);
  });

  it("applyWordPressAutopilotPlan never calls fetch for a mixed low/high-risk plan when env is unset", async () => {
    const plan: WebsiteAutopilotPlan = {
      score: 50,
      changes: [
        makeChange({ id: "c_low", riskLevel: "low", changeType: "headline", afterText: "Great local mortgage help" }),
        makeChange({ id: "c_high", riskLevel: "high", changeType: "rate_apr_language", afterText: "3.5% APR" }),
      ],
      summaryForMlo: "test",
      autoAppliedCount: 0,
      needsApprovalCount: 1,
      safeToShowMloSummary: true,
    };

    const result = await applyWordPressAutopilotPlan(plan);
    assert.equal(result.appliedCount, 0);
    assert.equal(result.changes.length, 2);
  });
});

describe("wordpress.ts — dry-run execution", () => {
  before(() => {
    clearWordPressEnv();
  });

  it("holds high-risk for approval, proposes low-risk, and never applies when dry-run", async () => {
    const plan: WebsiteAutopilotPlan = {
      score: 50,
      changes: [
        makeChange({ id: "c_low", riskLevel: "low", changeType: "headline", afterText: "Great local mortgage help" }),
        makeChange({ id: "c_high", riskLevel: "high", changeType: "rate_apr_language", afterText: "3.5% APR" }),
      ],
      summaryForMlo: "test",
      autoAppliedCount: 0,
      needsApprovalCount: 1,
      safeToShowMloSummary: true,
    };

    const result = await applyWordPressAutopilotPlan(plan);

    assert.equal(result.dryRun, true);
    assert.equal(result.appliedCount, 0);

    const low = result.changes.find((c) => c.id === "c_low");
    const high = result.changes.find((c) => c.id === "c_high");
    assert.equal(low?.status, "proposed");
    assert.equal(high?.status, "needs_approval");
    assert.equal(high?.requiresApproval, true);
  });

  it("stays dry-run when the flags are explicitly false", async () => {
    process.env.WORDPRESS_AUTOPILOT_ENABLED = "false";
    process.env.WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK = "false";
    try {
      const plan: WebsiteAutopilotPlan = {
        score: 50,
        changes: [makeChange({ id: "c_low", riskLevel: "low", afterText: "Great local mortgage help" })],
        summaryForMlo: "test",
        autoAppliedCount: 0,
        needsApprovalCount: 0,
        safeToShowMloSummary: true,
      };
      const result = await applyWordPressAutopilotPlan(plan);
      assert.equal(result.dryRun, true);
      assert.equal(result.appliedCount, 0);
    } finally {
      clearWordPressEnv();
    }
  });
});

describe("wordpress.ts — risk classification (delegates to shared classifyRisk)", () => {
  it("classifies a plain headline as low risk", () => {
    assert.equal(classifyWordPressChangeRisk("headline", "Get a mortgage quote today"), "low");
  });

  it("classifies rate/APR language as high risk", () => {
    assert.equal(classifyWordPressChangeRisk("rate_apr_language", "3.5% APR"), "high");
  });

  it("classifies platform_settings_change as high risk", () => {
    assert.equal(classifyWordPressChangeRisk("platform_settings_change", "update plugin settings"), "high");
  });

  it("upgrades a nominally low-risk headline containing compliance language away from low", () => {
    const risk = classifyWordPressChangeRisk("headline", "Guaranteed pre-approval today!");
    assert.notEqual(risk, "low");
  });
});

describe("wordpress.ts — Rank Math SEO field routing", () => {
  it("routes seo_title to rank_math_title, never the post content", () => {
    const payload = prepareWordPressUpdatePayload({ afterText: "Best Fresno Mortgage LOs | YPN", changeType: "seo_title" });
    assert.deepEqual(payload, { rank_math_title: "Best Fresno Mortgage LOs | YPN" });
  });

  it("routes seo_meta_description to rank_math_description, never the post content", () => {
    const payload = prepareWordPressUpdatePayload({
      afterText: "Exclusive ZIP territory access for licensed MLOs.",
      changeType: "seo_meta_description",
    });
    assert.deepEqual(payload, { rank_math_description: "Exclusive ZIP territory access for licensed MLOs." });
  });

  it("still routes non-SEO change types to content", () => {
    const payload = prepareWordPressUpdatePayload({ afterText: "New headline copy", changeType: "headline" });
    assert.deepEqual(payload, { content: "New headline copy" });
  });

  it("applyWordPressAutopilotPlan sends an seo_title change as rank_math_title, not content", async () => {
    process.env.WORDPRESS_SITE_URL = "https://ypnus.com";
    process.env.WORDPRESS_AUTOPILOT_USERNAME = "autopilot";
    process.env.WORDPRESS_AUTOPILOT_APP_PASSWORD = "secret";
    process.env.WORDPRESS_AUTOPILOT_ENABLED = "true";
    process.env.WORDPRESS_AUTOPILOT_AUTO_APPLY_LOW_RISK = "true";

    const originalFetch = globalThis.fetch;
    let capturedBody: string | undefined;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ id: 1 }), { status: 200 });
    }) as unknown as typeof globalThis.fetch;

    try {
      const plan: WebsiteAutopilotPlan = {
        score: 90,
        changes: [
          makeChange({
            id: "c_seo_title",
            riskLevel: "low",
            changeType: "seo_title",
            afterText: "Best Fresno Mortgage LOs | YPN",
          }),
        ],
        summaryForMlo: "test",
        autoAppliedCount: 0,
        needsApprovalCount: 0,
        safeToShowMloSummary: true,
      };

      const result = await applyWordPressAutopilotPlan(plan, { id: 1, type: "page" });

      assert.equal(result.appliedCount, 1);
      assert.ok(capturedBody);
      const parsed = JSON.parse(capturedBody as string);
      assert.deepEqual(parsed, { rank_math_title: "Best Fresno Mortgage LOs | YPN" });
    } finally {
      globalThis.fetch = originalFetch;
      clearWordPressEnv();
    }
  });
});
