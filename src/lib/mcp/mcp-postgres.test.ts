import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
import type { SqlClient, SqlExecutor } from "@/lib/persistence/sql-client";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-mcp-postgres-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

/**
 * The MCP endpoint's ZIP code tools answer from the same ledger the website does. These tests pin
 * that down for every step of the move to PostgreSQL: the tools must give the right answer in each
 * mode, keep answering through a database outage, and never turn a burst of MCP calls into a
 * burst of database queries.
 */
describe("MCP ZIP code tools during the move to PostgreSQL", async () => {
  const { writeDb } = await import("@/lib/db");
  const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("@/lib/repositories/json-repositories");
  const { Persistence } = await import("@/lib/repositories/persistence");
  const { replacePersistenceForTests } = await import("@/lib/repositories");
  const { createPgliteClient, subscription, withOutageSwitch } = await import("@/lib/repositories/test-support");
  const { zipStatusResolver } = await import("@/lib/zip-status");
  const { checkZip, checkZips, nearbyOpenZips } = await import("./tools");

  let database: SqlClient;
  let switched: SqlClient & { down: boolean };
  let now = Date.now();
  let ledgerLoads = 0;
  let connects = 0;

  /** Counts the read model's "load the whole ledger" query, to prove calls are not passed through one by one. */
  function counting(client: SqlClient): SqlClient {
    const count = (text: string) => {
      if (/select distinct zip from zip_claims/.test(text)) ledgerLoads += 1;
    };
    const wrap = (target: SqlExecutor): SqlExecutor => ({
      query: ((text: string, params?: unknown[]) => {
        count(text);
        return target.query(text, params);
      }) as SqlExecutor["query"],
      exec: (text) => target.exec(text),
    });
    return { ...wrap(client), transaction: (fn) => client.transaction((tx) => fn(wrap(tx))), close: async () => undefined };
  }

  async function use(ledger: StoreMode, subscriptions: StoreMode) {
    const modes: PersistenceModes = { ledger, subscriptions, warnings: [] };
    const instance = new Persistence({
      modes,
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      connect: async () => {
        connects += 1;
        if (switched.down) throw new Error("connect ECONNREFUSED");
        return counting(switched);
      },
      clock: () => now,
      retryAfterMs: 10_000,
      recheckAfterMs: 1,
      log: () => undefined,
    });
    await replacePersistenceForTests(instance);
    await instance.start();
    return instance;
  }
  const tick = () => new Promise((resolve) => setTimeout(resolve, 25));

  before(async () => {
    database = await createPgliteClient();
    switched = withOutageSwitch(database);
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });
  afterEach(async () => {
    await replacePersistenceForTests(null);
    zipStatusResolver.clear();
    switched.down = false;
    now = Date.now();
    ledgerLoads = 0;
    connects = 0;
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
    await database.exec("drop table if exists zip_claims, revenue_subscriptions, persistence_state, schema_migrations cascade");
  });
  after(async () => {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  for (const [ledger, subscriptions] of [
    ["json", "json"],
    ["shadow", "shadow"],
    ["postgres", "shadow"],
    ["postgres", "postgres"],
  ] as Array<[StoreMode, StoreMode]>) {
    it(`check_zip_availability is right after a payment (ledger=${ledger}, subscriptions=${subscriptions})`, async () => {
      const persistence = await use(ledger, subscriptions);
      assert.equal(checkZip("93618").status, "open");

      await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
      // No wait: the very next MCP call after the payment must already say locked.
      const locked = checkZip("93618");
      assert.deepEqual({ status: locked.status, available: locked.available, valid: locked.valid }, { status: "locked", available: false, valid: true });
      assert.equal(checkZip("93291").status, "open");
      assert.equal(checkZip("9361").status, "invalid");

      const batch = checkZips(["93618", "93291", "93618", "abc"]);
      assert.deepEqual(batch.results.map((answer) => answer.status), ["locked", "open", "invalid"]);

      // A cancellation reopens it for MCP callers too.
      const [stored] = await persistence.subscriptions.list();
      await persistence.subscriptions.save({ ...stored, status: "cancelled" });
      assert.equal(checkZip("93618").status, "open");
    });
  }

  it("find_nearby_open_zips leaves out ZIP codes locked in PostgreSQL", async () => {
    const persistence = await use("postgres", "postgres");
    const open = await nearbyOpenZips("93618", 5);
    assert.ok(open.valid && open.neighbors.length > 0, "the bundled ZIP data has neighbours for 93618");
    const taken = open.neighbors[0].zip;

    await persistence.subscriptions.saveWithZipClaim(subscription(), taken);
    zipStatusResolver.clear(); // its own 5-second cache, cleared so this checks the ledger itself
    const after = await nearbyOpenZips("93618", 5);
    assert.equal(after.neighbors.some((neighbor) => neighbor.zip === taken), false);
  });

  it("a burst of MCP calls during payments is answered from memory, not with one query per call", async () => {
    const persistence = await use("postgres", "postgres");
    const zips = ["93601", "93602", "93603", "93604", "93605"];
    const loadsBefore = ledgerLoads;

    const payments = zips.map((zip) => persistence.subscriptions.saveWithZipClaim(subscription(), zip));
    const burst = Array.from({ length: 300 }, (_, index) => checkZip(zips[index % zips.length]));
    assert.equal(burst.every((answer) => answer.valid && (answer.status === "open" || answer.status === "locked")), true);
    await Promise.all(payments);

    assert.deepEqual(zips.map((zip) => checkZip(zip).status), ["locked", "locked", "locked", "locked", "locked"]);
    // One reload per write at most, never one per MCP call.
    assert.ok(ledgerLoads - loadsBefore <= zips.length + 1, `expected at most ${zips.length + 1} ledger loads, saw ${ledgerLoads - loadsBefore}`);
    assert.equal(persistence.status().ledgerFallbacks, 0);
  });

  it("MCP callers get answers through a database outage, and the outage is not hammered", async () => {
    const persistence = await use("postgres", "postgres");
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    const connectsBefore = connects;

    switched.down = true;
    // Still fresh: answered from the copy in memory.
    assert.equal(checkZip("93618").status, "locked");
    // Hours later the copy is too old: the data file's copy answers, still correctly.
    now += 3 * 3_600_000;
    for (let index = 0; index < 200; index += 1) {
      assert.equal(checkZip("93618").status, "locked");
      assert.equal(checkZip("93291").status, "open");
    }
    await tick();
    assert.ok(persistence.status().ledgerFallbacks >= 1);
    assert.ok(connects - connectsBefore <= 1, `400 calls during an outage made ${connects - connectsBefore} reconnect attempts`);

    // The database returns: after the retry wait, answers come from PostgreSQL again.
    switched.down = false;
    now += 11_000;
    checkZip("93618");
    await tick();
    const fallbacks = persistence.status().ledgerFallbacks;
    assert.equal(checkZip("93618").status, "locked");
    assert.equal(persistence.status().ledgerFallbacks, fallbacks);
    assert.equal(persistence.status().ready, true);
  });

  it("a database that is down when the server starts does not stop MCP answers", async () => {
    writeDb((db) => {
      db.revenueSubscriptions.push(subscription({ claimedZips: ["93618"] }));
    });
    switched.down = true;
    const persistence = await use("postgres", "postgres");
    assert.equal(persistence.status().ready, false);
    assert.equal(checkZip("93618").status, "locked");
    assert.equal(checkZip("93291").status, "open");
    assert.deepEqual(checkZips(["93618", "93291"]).results.map((answer) => answer.status), ["locked", "open"]);
  });
});
