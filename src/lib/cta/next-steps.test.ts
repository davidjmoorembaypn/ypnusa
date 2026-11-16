import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLUSTER_NEXT_STEPS, nextStepForCluster, nextStepForWpPage, ZIP_STEP } from "./next-steps";
import { TOPIC_CLUSTERS } from "@/lib/seo/clusters";
import consolidated from "@/content/consolidated-pages.json";

describe("next steps", () => {
  it("every topic cluster ends in its own step", () => {
    for (const cluster of TOPIC_CLUSTERS) assert.ok(CLUSTER_NEXT_STEPS[cluster.slug], cluster.slug);
  });

  it("each step has one primary action and points at live pages", () => {
    const retired = consolidated as Record<string, string>;
    for (const step of Object.values(CLUSTER_NEXT_STEPS)) {
      for (const action of [step.primary, step.secondary].filter(Boolean)) {
        assert.ok(action!.href.startsWith("/"), action!.href);
        assert.ok(!(action!.href.split("?")[0] in retired), `${action!.href} redirects`);
        assert.ok(action!.label.length <= 30, action!.label);
      }
      assert.ok(!/guarantee|\d+%|\d+x\b/i.test(step.body), step.body);
    }
  });

  it("falls back to the ZIP code check", () => {
    assert.equal(nextStepForCluster(undefined), ZIP_STEP);
    assert.equal(nextStepForCluster("nope"), ZIP_STEP);
    assert.equal(nextStepForWpPage("", "/some-landing-page"), ZIP_STEP);
  });

  it("matches the page's intent", () => {
    assert.equal(nextStepForWpPage("/vs", "/vs/bonzo")?.primary.href, "/pricing");
    assert.equal(nextStepForWpPage("/markets", "/markets/boston-ma")?.primary.href, "/claim-territory");
    assert.equal(nextStepForWpPage("", "/editorial-policy"), null);
  });
});
