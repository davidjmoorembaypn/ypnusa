import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-territory-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function sub(overrides: Partial<RevenueSubscriptionRecord>): RevenueSubscriptionRecord {
  const now = new Date().toISOString();
  return {
    id: `sub_${Math.random().toString(36).slice(2)}`,
    createdAt: now,
    startedAt: now,
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    claimedZips: [],
    ...overrides,
  };
}

describe("territory availability reflects only real claims", async () => {
  const { writeDb } = await import("./db");
  const { checkTerritory, totalClaimedTerritories } = await import("./territory");
  const { scoreZip, suggestTerritory } = await import("./agents/zipLogicAgent");
  const savedSource = process.env.TERRITORY_SOURCE;

  after(() => {
    if (savedSource === undefined) delete process.env.TERRITORY_SOURCE;
    else process.env.TERRITORY_SOURCE = savedSource;
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    writeDb((db) => {
      db.revenueSubscriptions = [];
      db.demoRequests = [];
    });
  });

  it("no longer shows popular metro ZIP codes as taken when nobody owns them", () => {
    for (const zip of ["90210", "10001", "78701", "33139"]) {
      assert.equal(checkTerritory(zip).available, true, zip);
    }
    assert.equal(totalClaimedTerritories(), 0);
  });

  it("ignores seeded demo subscriptions but honors a real paid claim", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        sub({ source: "seed", claimedZips: ["85251"] }),
        sub({ source: "stripe_webhook", claimedZips: ["93720"], ownerEmail: "mlo@example.com" }),
      ];
    });
    assert.equal(checkTerritory("85251").available, true);
    assert.equal(checkTerritory("93720").available, false);
    assert.equal(totalClaimedTerritories(), 1);
  });

  it("zip agent reports availability only and recognises the viewer's own ZIP code", async () => {
    process.env.TERRITORY_SOURCE = "local";
    writeDb((db) => {
      db.revenueSubscriptions = [sub({ claimedZips: ["93720"], ownerEmail: "Owner@Example.com" })];
    });

    const mine = await scoreZip("93720", { email: "owner@example.com" });
    assert.equal(mine.status, "yours");
    assert.equal(mine.ownedByYou, true);
    assert.doesNotMatch(mine.reason, /another officer/i);
    assert.equal("score" in mine, false, "no made-up opportunity score");

    const theirs = await scoreZip("93720", { email: "someone.else@example.com" });
    assert.equal(theirs.status, "taken");

    const open = await suggestTerritory("93711");
    assert.equal(open.status, "open");
    assert.match(open.recommendation, /paid plan/);
  });
});
