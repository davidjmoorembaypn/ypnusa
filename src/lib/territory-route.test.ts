import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it, mock } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-territory-route-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

function paidSub(zip: string, overrides: Partial<RevenueSubscriptionRecord> = {}): RevenueSubscriptionRecord {
  return {
    id: `sub_${zip}`,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    stripeSubscriptionId: `stripe_${zip}`,
    stripeCustomerId: `cus_${zip}`,
    claimedZips: [zip],
    ...overrides,
  };
}

describe("territory availability comes from this app's paid ledger", async () => {
  const { GET } = await import("../app/api/territory/check/route");
  const { writeDb } = await import("./db");
  const { checkLedgerTerritory } = await import("./territory-ledger");
  const { zipStatusResolver } = await import("./zip-status");
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    zipStatusResolver.clear();
    writeDb((db) => {
      db.revenueSubscriptions = [];
      db.demoRequests = [];
    });
  });
  afterEach(() => {
    mock.restoreAll();
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Object.assign(process.env, { NODE_ENV: originalNodeEnv });
  });
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  const check = async (zip: string) => {
    const response = await GET(new Request(`https://ypnus.com/api/territory/check?zip=${zip}`));
    return { response, body: await response.json() };
  };

  it("answers in production without calling any other host", async () => {
    Object.assign(process.env, { NODE_ENV: "production" });
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("the territory check must not make a network call");
    });
    const { response, body } = await check("93618");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(body.available, true);
    assert.equal(body.source, "ledger");
    assert.equal(body.city, "Dinuba");
    assert.equal(body.state, "CA");
    assert.equal(fetchMock.mock.callCount(), 0);
    // Demand is populated natively and labeled as an estimate.
    for (const key of ["buyers", "sellers", "movers_in", "total"]) assert.ok(Number.isInteger(body.demand[key]) && body.demand[key] > 0, key);
    assert.equal(body.demand.window_days, 60);
    assert.equal(body.demand.total, body.demand.buyers + body.demand.sellers + body.demand.movers_in);
    assert.equal(body.demand.source, "market_demographic_model");
    assert.match(body.demand.methodology, /not a lead guarantee/);
  });

  it("shows a ZIP code as claimed once a paid subscription holds it", async () => {
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub("93618")];
    });
    const { body } = await check("93618");
    assert.equal(body.available, false);
    assert.match(body.message, /Dinuba, CA is exclusively locked/);
    assert.equal((await check("93616")).body.available, true);
  });

  it("ignores demo seeds, cancelled plans, trials and demo-request holds", async () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        paidSub("93618", { source: "seed" }),
        paidSub("93616", { status: "cancelled" }),
        paidSub("93646", { status: "trialing", claimedZips: [], pendingZip: "93646" }),
      ];
      db.demoRequests = [{ id: "d1", createdAt: new Date().toISOString(), zip: "93647" } as never];
    });
    for (const zip of ["93618", "93616", "93646", "93647"]) assert.equal((await check(zip)).body.available, true, zip);
  });

  it("rejects a malformed ZIP code and one that isn't a U.S. ZIP code", async () => {
    const bad = await check("12");
    assert.equal(bad.body.valid, false);
    assert.equal(bad.body.demand, null);
    assert.equal(bad.body.available, false);
    const unknownPlace = checkLedgerTerritory("00000");
    assert.equal(unknownPlace.valid, false);
    assert.equal(unknownPlace.available, false);
    assert.equal(unknownPlace.city, null);
    assert.match(unknownPlace.message, /00000 isn't a U\.S\. ZIP code/);
    const viaRoute = await check("00000");
    assert.equal(viaRoute.body.valid, false);
    assert.equal(viaRoute.body.available, false);
    assert.equal(viaRoute.body.demand, null);
  });

  it("the shared status resolver agrees with the ledger", async () => {
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub("93618")];
    });
    assert.equal((await zipStatusResolver.resolve("93618")).status, "claimed");
    assert.equal((await zipStatusResolver.resolve("93616")).status, "open");
    assert.equal((await zipStatusResolver.resolve("nope")).status, "unknown");
  });
});
