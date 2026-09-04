import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const routeSource = fs.readFileSync(path.join(__dirname, "route.ts"), "utf8");
const dashboardSource = fs.readFileSync(
  path.join(__dirname, "../../../dashboard/page.tsx"),
  "utf8",
);

describe("Website Autopilot Command Center — /api/autopilot/plan route", () => {
  it("calls the pure plan generator and logs a run — never a WordPress write", () => {
    assert.match(routeSource, /generateWebsiteAutopilotPlan/);
    assert.match(routeSource, /buildAutopilotRunRecord/);
    assert.match(routeSource, /saveAutopilotRun/);
    // These would perform (or gate) a live WordPress network call, or persist
    // full change records — none of them may appear in this route: the UI
    // must stay dry-run only, logging just a run-history summary.
    for (const forbidden of [
      "fetchWordPressContent",
      "applyWordPressAutopilotPlan",
      "conditionallyUpdateWordPressContent",
      "runWebsiteAutopilot",
    ]) {
      assert.ok(!routeSource.includes(forbidden), `route.ts must not reference ${forbidden}`);
    }
  });

  it("only reads WordPress Autopilot status (env-var read, not a network call)", () => {
    assert.match(routeSource, /getWordPressAutopilotStatus/);
  });

  it("requires a signed-in session before generating a plan", () => {
    assert.match(routeSource, /getSession/);
    assert.match(routeSource, /UNAUTHENTICATED/);
  });
});

describe("Website Autopilot Command Center — /api/autopilot/runs route", () => {
  const runsRouteSource = fs.readFileSync(path.join(__dirname, "../runs/route.ts"), "utf8");

  it("only reads run history — no WordPress or write helpers referenced", () => {
    assert.match(runsRouteSource, /listAutopilotRuns/);
    for (const forbidden of [
      "fetchWordPressContent",
      "applyWordPressAutopilotPlan",
      "conditionallyUpdateWordPressContent",
      "saveAutopilotRun",
      "saveWebsiteAutopilotChange",
    ]) {
      assert.ok(!runsRouteSource.includes(forbidden), `runs/route.ts must not reference ${forbidden}`);
    }
  });

  it("requires a signed-in session before returning history", () => {
    assert.match(runsRouteSource, /getSession/);
    assert.match(runsRouteSource, /UNAUTHENTICATED/);
  });
});

describe("Website Autopilot Command Center — dashboard navigation", () => {
  it("links to /dashboard/autopilot from the dashboard hub", () => {
    assert.match(dashboardSource, /\/dashboard\/autopilot/);
    assert.match(dashboardSource, /Website Autopilot/);
  });
});
