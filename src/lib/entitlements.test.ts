import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  automationDailyLimitFor,
  canReceivePaidLeadDelivery,
  FREE_ENTITLEMENT,
  hasZipCapacity,
  isPaidEntitlement,
  requireTierOrError,
  resolveEntitlement,
  resolveOfficerEntitlement,
  tierAtLeast,
  zipCapacityFor,
} from "./entitlements";
import type { SessionPayload } from "./session";

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
  return { sub: "wp_1", email: "lo@example.com", role: "mlo", iat: 0, exp: 9_999_999_999, ...overrides };
}

describe("resolveEntitlement", () => {
  it("resolves to the free entitlement for a null session", () => {
    assert.deepEqual(resolveEntitlement(null), FREE_ENTITLEMENT);
  });

  it("resolves to free when the session carries no tier claim at all", () => {
    const result = resolveEntitlement(session());
    assert.equal(result.tier, "free");
    assert.equal(result.hasVerifiedClaim, false);
  });

  it("grants the claimed tier when subscriptionStatus is active", () => {
    const result = resolveEntitlement(session({ tier: "growth", subscriptionStatus: "active" }));
    assert.equal(result.tier, "growth");
    assert.equal(result.hasVerifiedClaim, true);
  });

  it("grants the claimed tier while trialing", () => {
    const result = resolveEntitlement(session({ tier: "pro", subscriptionStatus: "trialing", trialEndsAt: "2026-10-01T00:00:00Z" }));
    assert.equal(result.tier, "pro");
    assert.equal(result.trialEndsAt, "2026-10-01T00:00:00Z");
  });

  it("falls back to free once payment has lapsed (past_due), even though the tier claim still says elite", () => {
    const result = resolveEntitlement(session({ tier: "elite", subscriptionStatus: "past_due" }));
    assert.equal(result.tier, "free");
  });

  it("falls back to free for a canceled subscription", () => {
    const result = resolveEntitlement(session({ tier: "elite", subscriptionStatus: "canceled" }));
    assert.equal(result.tier, "free");
  });
});

describe("tierAtLeast / isPaidEntitlement", () => {
  it("orders tiers free < starter < growth < pro < elite", () => {
    const elite = resolveEntitlement(session({ tier: "elite", subscriptionStatus: "active" }));
    for (const tier of ["free", "starter", "growth", "pro", "elite"] as const) {
      assert.equal(tierAtLeast(elite, tier), true, `elite should be at least ${tier}`);
    }
    const starter = resolveEntitlement(session({ tier: "starter", subscriptionStatus: "active" }));
    assert.equal(tierAtLeast(starter, "growth"), false);
    assert.equal(tierAtLeast(starter, "starter"), true);
  });

  it("free is never a paid entitlement; every other tier is", () => {
    assert.equal(isPaidEntitlement(FREE_ENTITLEMENT), false);
    assert.equal(isPaidEntitlement(resolveEntitlement(session({ tier: "starter", subscriptionStatus: "active" }))), true);
  });
});

describe("ZIP capacity", () => {
  it("free tier has zero ZIP capacity — exclusive ZIP activation is paid-only", () => {
    assert.equal(zipCapacityFor(FREE_ENTITLEMENT), 0);
    assert.equal(hasZipCapacity(FREE_ENTITLEMENT, 0), false);
  });

  it("every paid tier includes exactly 1 ZIP — higher plans buy capability, not more included ZIPs", () => {
    for (const tier of ["starter", "growth", "pro", "elite"] as const) {
      const entitlement = resolveEntitlement(session({ tier, subscriptionStatus: "active" }));
      assert.equal(hasZipCapacity(entitlement, 0), true, `${tier} should allow the 1st ZIP`);
      assert.equal(hasZipCapacity(entitlement, 1), false, `${tier} should not allow a 2nd ZIP without an add-on`);
    }
  });
});

describe("canReceivePaidLeadDelivery", () => {
  it("free cannot receive paid lead delivery", () => {
    assert.equal(canReceivePaidLeadDelivery(FREE_ENTITLEMENT), false);
  });

  it("any active paid tier can", () => {
    const starter = resolveEntitlement(session({ tier: "starter", subscriptionStatus: "trialing" }));
    assert.equal(canReceivePaidLeadDelivery(starter), true);
  });
});

describe("automationDailyLimitFor", () => {
  it("free gets zero automation runs", () => {
    assert.equal(automationDailyLimitFor(FREE_ENTITLEMENT), 0);
  });

  it("scales up with tier, elite is uncapped", () => {
    const starter = resolveEntitlement(session({ tier: "starter", subscriptionStatus: "active" }));
    const growth = resolveEntitlement(session({ tier: "growth", subscriptionStatus: "active" }));
    const elite = resolveEntitlement(session({ tier: "elite", subscriptionStatus: "active" }));
    assert.ok(automationDailyLimitFor(growth) > automationDailyLimitFor(starter));
    assert.equal(automationDailyLimitFor(elite), Number.POSITIVE_INFINITY);
  });
});

describe("resolveOfficerEntitlement", () => {
  it("treats an officer with no entitlement snapshot as unrestricted (not free) — see the doc comment for why", () => {
    const result = resolveOfficerEntitlement({});
    assert.equal(result.tier, "elite");
    assert.equal(result.hasVerifiedClaim, false);
    assert.equal(automationDailyLimitFor(result), Number.POSITIVE_INFINITY);
  });

  it("once a snapshot exists, it's enforced exactly like a session claim (fails closed on lapsed payment)", () => {
    const active = resolveOfficerEntitlement({ entitlementTier: "starter", entitlementStatus: "active" });
    assert.equal(active.tier, "starter");

    const lapsed = resolveOfficerEntitlement({ entitlementTier: "elite", entitlementStatus: "past_due" });
    assert.equal(lapsed.tier, "free");
  });
});

describe("requireTierOrError", () => {
  it("returns null (pass) when the entitlement meets the minimum", () => {
    const growth = resolveEntitlement(session({ tier: "growth", subscriptionStatus: "active" }));
    assert.equal(requireTierOrError(growth, "starter"), null);
  });

  it("returns a 402 UPGRADE_REQUIRED error when it doesn't", async () => {
    const response = requireTierOrError(FREE_ENTITLEMENT, "starter");
    assert.ok(response);
    assert.equal(response!.status, 402);
    const body = await response!.json();
    assert.equal(body.code, "UPGRADE_REQUIRED");
  });
});
