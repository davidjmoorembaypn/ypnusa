import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildResultsFunnel, type ResultsFunnelInput } from "./funnel";

const now = new Date("2026-10-24T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const base: ResultsFunnelInput = {
  analyticsEvents: [],
  demoRequests: [],
  revenueSubscriptions: [],
  paymentConversions: [],
  conversions: { qualifyingConversions: 0, paidButNotFulfilled: [], goal: 3 },
  now,
};

describe("results funnel", () => {
  it("returns five stages in order with zero totals for an empty ledger", () => {
    const funnel = buildResultsFunnel(base);
    assert.deepEqual(funnel.stages.map((s) => s.id), ["cta_clicks", "requests", "trials", "active", "verified"]);
    assert.ok(funnel.stages.every((s) => s.total === 0 && s.conversionFromPrevious === null));
    assert.equal(funnel.remainingToGoal, 3);
    assert.match(funnel.headline, /No territory requests/);
  });

  it("excludes seed subscriptions and counts trials and active plans separately", () => {
    const funnel = buildResultsFunnel({
      ...base,
      revenueSubscriptions: [
        { status: "active", source: "seed", startedAt: day(100) },
        { status: "trialing", source: "stripe_webhook", startedAt: day(2) },
        { status: "active", source: "stripe_webhook", startedAt: day(20) },
        { status: "cancelled", source: "stripe_webhook", startedAt: day(30) },
      ],
    });
    const byId = Object.fromEntries(funnel.stages.map((s) => [s.id, s]));
    assert.equal(byId.trials.total, 1);
    assert.equal(byId.trials.last7Days, 1);
    assert.equal(byId.active.total, 1);
    assert.equal(byId.active.last7Days, 0);
  });

  it("computes step conversion against the previous stage and counts only CTA click events", () => {
    const funnel = buildResultsFunnel({
      ...base,
      analyticsEvents: [
        { type: "funnel_cta_clicked", createdAt: day(1) },
        { type: "funnel_cta_clicked", createdAt: day(10) },
        { type: "intake_started", createdAt: day(1) },
        { type: "funnel_cta_clicked", createdAt: day(1) },
        { type: "funnel_cta_clicked", createdAt: day(2) },
      ],
      demoRequests: [{ createdAt: day(1) }],
    });
    const byId = Object.fromEntries(funnel.stages.map((s) => [s.id, s]));
    assert.equal(byId.cta_clicks.total, 4);
    assert.equal(byId.cta_clicks.last7Days, 3);
    assert.equal(byId.requests.conversionFromPrevious, 0.25);
  });

  it("uses the verified-conversion count for the last stage and flags unfulfilled payments first", () => {
    const funnel = buildResultsFunnel({
      ...base,
      demoRequests: [{ createdAt: day(1) }],
      paymentConversions: [{ paidAt: day(1) }, { paidAt: day(40) }],
      conversions: { qualifyingConversions: 1, paidButNotFulfilled: ["cus_…abcd"], goal: 3 },
    });
    const verified = funnel.stages.find((s) => s.id === "verified");
    assert.equal(verified?.total, 1);
    assert.equal(verified?.last7Days, 1);
    assert.equal(funnel.remainingToGoal, 2);
    assert.equal(funnel.paidButNotFulfilled, 1);
    assert.match(funnel.headline, /not yet active in the app/);
  });

  it("states the goal as reached only when verified >= goal", () => {
    const funnel = buildResultsFunnel({ ...base, conversions: { qualifyingConversions: 3, paidButNotFulfilled: [], goal: 3 } });
    assert.equal(funnel.remainingToGoal, 0);
    assert.match(funnel.headline, /Goal reached/);
  });

  it("explains the card-required trial when trials exist but none is paid", () => {
    const funnel = buildResultsFunnel({
      ...base,
      demoRequests: [{ createdAt: day(1) }],
      revenueSubscriptions: [{ status: "trialing", source: "stripe_webhook", startedAt: day(1) }],
    });
    assert.match(funnel.headline, /first charge comes when the trial ends/);
  });

  it("ignores future-dated and invalid timestamps in the 7-day window", () => {
    const funnel = buildResultsFunnel({
      ...base,
      demoRequests: [{ createdAt: new Date(now.getTime() + 86_400_000).toISOString() }, { createdAt: "not-a-date" }],
    });
    assert.equal(funnel.stages.find((s) => s.id === "requests")?.last7Days, 0);
  });
});
