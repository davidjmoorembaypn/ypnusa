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
  it("only calls the pure, non-persisting plan generator — no WordPress writes", () => {
    assert.match(routeSource, /generateWebsiteAutopilotPlan/);
    // These would perform (or gate) a live WordPress network call — none of them
    // may appear in this route tonight: the UI must stay dry-run only.
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

describe("Website Autopilot Command Center — dashboard navigation", () => {
  it("links to /dashboard/autopilot from the dashboard hub", () => {
    assert.match(dashboardSource, /\/dashboard\/autopilot/);
    assert.match(dashboardSource, /Website Autopilot/);
  });
});
