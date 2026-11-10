import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_EVENTS, isFunnelEvent, landingPageType, sanitizeFunnelParams } from "./funnel-events";

describe("funnel events", () => {
  it("lists the funnel in order", () => {
    assert.deepEqual([...FUNNEL_EVENTS], [
      "landing_view",
      "site_preview_open",
      "signup_complete",
      "growth_profile_saved",
      "mlo_site_configured",
      "checkout_started",
      "first_payment_succeeded",
    ]);
    assert.equal(isFunnelEvent("checkout_started"), true);
    assert.equal(isFunnelEvent("generate_lead"), false);
  });

  it("keeps only allowed, non-personal params", () => {
    assert.deepEqual(
      sanitizeFunnelParams({
        plan: "growth",
        checkout: "trial",
        step: 2,
        path: "/pricing?email=a@b.com#x",
        email: "borrower@example.com",
        phone: "5595551234",
        name: "Jane Borrower",
        loanAmount: 450000,
        source: "jane@example.com",
      }),
      { plan: "growth", checkout: "trial", step: 2, path: "/pricing" },
    );
    assert.deepEqual(sanitizeFunnelParams({ source: "call 5595551234" }), {});
    assert.deepEqual(sanitizeFunnelParams(undefined), {});
  });

  it("only counts public marketing pages as landings", () => {
    assert.equal(landingPageType("/"), "home");
    assert.equal(landingPageType("/pricing"), "pricing");
    assert.equal(landingPageType("/features/branded-mlo-website"), "features");
    assert.equal(landingPageType("/loginhelp"), "loginhelp");
    for (const path of ["/dashboard", "/dashboard/leads", "/onboarding", "/lo/jane-doe", "/api/x", "/login", "/admin/revenue"]) {
      assert.equal(landingPageType(path), null, path);
    }
  });
});
