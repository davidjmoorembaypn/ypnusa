import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildWeeklyPlan, type GrowthPlanInput } from "./weekly-plan";

const base: GrowthPlanInput = {
  leadsLast7Days: 3,
  leadsPrevious7Days: 3,
  leadsEver: 20,
  awaitingBooking: 0,
  failedOutreach: 0,
  paidPlan: true,
  claimedZips: 1,
};

describe("weekly growth plan", () => {
  it("never returns more than three actions, highest priority first", () => {
    const plan = buildWeeklyPlan({ ...base, failedOutreach: 2, awaitingBooking: 4, claimedZips: 0, leadsLast7Days: 0 });
    assert.equal(plan.length, 3);
    assert.deepEqual(
      plan.map((action) => action.id),
      ["fix_failed_outreach", "reach_unbooked_leads", "claim_zip"],
    );
  });

  it("puts failed follow-ups first and uses the real count", () => {
    const plan = buildWeeklyPlan({ ...base, failedOutreach: 1 });
    assert.equal(plan[0].id, "fix_failed_outreach");
    assert.match(plan[0].title, /1 failed follow-up$/);
  });

  it("tells a paid officer with no claimed zip code to choose one", () => {
    const plan = buildWeeklyPlan({ ...base, claimedZips: 0 });
    assert.ok(plan.some((action) => action.id === "claim_zip"));
  });

  it("points a free officer at the free zip check without implying the zip is reserved", () => {
    const plan = buildWeeklyPlan({ ...base, paidPlan: false, claimedZips: 0 });
    const action = plan.find((item) => item.id === "check_zip");
    assert.ok(action);
    assert.match(action.why, /locked only when a paid plan starts/);
    assert.ok(!plan.some((item) => item.id === "claim_zip"));
  });

  it("suggests sharing the borrower link when there has never been a borrower", () => {
    const plan = buildWeeklyPlan({ ...base, leadsEver: 0, leadsLast7Days: 0, leadsPrevious7Days: 0 });
    assert.ok(plan.some((action) => action.id === "share_borrower_link"));
  });

  it("states the real week-over-week numbers when borrowers dip", () => {
    const plan = buildWeeklyPlan({ ...base, leadsLast7Days: 1, leadsPrevious7Days: 4 });
    const dip = plan.find((action) => action.id === "reverse_dip");
    assert.ok(dip);
    assert.match(dip.why, /1 new this week versus 4/);
  });

  it("always offers a low-effort profile refresh when nothing is urgent", () => {
    const plan = buildWeeklyPlan(base);
    assert.deepEqual(plan.map((action) => action.id), ["refresh_gbp"]);
  });

  it("only links to pages that exist in the app", () => {
    const hrefs = new Set(
      buildWeeklyPlan({ ...base, failedOutreach: 1, awaitingBooking: 1, claimedZips: 0, leadsEver: 0 }).map(
        (action) => action.href,
      ),
    );
    for (const href of hrefs) {
      assert.match(href, /^\/(portal\/nurture|dashboard\/territories|tools\/social-writer|tools\/gbp-optimizer|pricing)$/);
    }
  });
});
