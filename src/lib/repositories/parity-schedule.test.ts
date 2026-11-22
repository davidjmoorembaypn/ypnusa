import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
import type { SqlClient } from "@/lib/persistence/sql-client";

/**
 * The scheduled comparison of the two stores. Before it, drift during a long shadow run only
 * showed at the next restart, so /api/health could report "parity clean" from days earlier.
 */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-parity-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("scheduled parity check", async () => {
  const { writeDb } = await import("@/lib/db");
  const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("./json-repositories");
  const { Persistence } = await import("./persistence");
  const { replacePersistenceForTests } = await import("./index");
  const { createPgliteClient, subscription, withOutageSwitch } = await import("./test-support");

  let database: SqlClient;
  let switched: SqlClient & { down: boolean };
  const open: Array<InstanceType<typeof Persistence>> = [];
  const logs: string[] = [];

  const modes = (ledger: StoreMode, subscriptions: StoreMode): PersistenceModes => ({ ledger, subscriptions, warnings: [] });
  function start(ledger: StoreMode, subscriptions: StoreMode, parityEveryMs: number) {
    const instance = new Persistence({
      modes: modes(ledger, subscriptions),
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      connect: async () => {
        if (switched.down) throw new Error("connect ECONNREFUSED");
        return { ...switched, query: switched.query, exec: switched.exec, transaction: switched.transaction, close: async () => undefined };
      },
      retryAfterMs: 1,
      recheckAfterMs: 1,
      parityEveryMs,
      log: (message) => logs.push(message),
    }).activate();
    open.push(instance);
    return instance;
  }
  const waitFor = async (check: () => boolean, ms = 3_000) => {
    const until = Date.now() + ms;
    while (!check()) {
      if (Date.now() > until) throw new Error("condition not met in time");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  before(async () => {
    database = await createPgliteClient();
    switched = withOutageSwitch(database);
  });
  afterEach(async () => {
    for (const instance of open.splice(0)) await instance.close();
    await replacePersistenceForTests(null);
    switched.down = false;
    logs.length = 0;
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
    await database.exec("delete from zip_claims; delete from revenue_subscriptions;").catch(() => undefined);
  });
  after(async () => {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("a difference made after start-up is found by the next scheduled check, counted, and repaired", async () => {
    const persistence = start("shadow", "shadow", 25);
    assert.equal(await persistence.start(), true);
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    await persistence.periodicParity();
    assert.equal(persistence.status().parity?.clean, true);
    assert.equal(persistence.status().driftDetected, 0);

    // A plan reaches the data file without going through the repositories (drift).
    const stray = subscription();
    writeDb((db) => {
      db.revenueSubscriptions.push(stray);
    });
    // The schedule finds it without a restart, counts it, and copies it to PostgreSQL.
    await waitFor(() => persistence.status().driftDetected === 1);
    assert.ok(logs.some((line) => line.includes("parity check found differences")));
    await waitFor(() => persistence.status().parity?.clean === true);
    const { rows } = await database.query<{ id: string }>("select id from revenue_subscriptions where id = $1", [stray.id]);
    assert.equal(rows.length, 1);
    assert.equal(persistence.status().driftDetected, 1, "counted once, not on every later check");
  });

  it("does not run at all in json mode, or when turned off", async () => {
    const jsonMode = start("json", "json", 10);
    await jsonMode.start();
    const off = start("shadow", "shadow", 0);
    await off.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(jsonMode.status().parity, null);
    // "off" compared once at start-up and never again.
    const atStart = off.status().parity?.checkedAt;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(off.status().parity?.checkedAt, atStart);
  });

  it("a database outage during a scheduled check is not an error and keeps the last result", async () => {
    const persistence = start("shadow", "shadow", 0);
    assert.equal(await persistence.start(), true);
    const before = persistence.status().parity;
    switched.down = true;
    await persistence.close(); // drops the connection, so the next check must reconnect
    assert.equal(await persistence.periodicParity(), null);
    assert.deepEqual(persistence.status().parity, before);
  });

  it("two scheduled checks never overlap", async () => {
    const persistence = start("shadow", "shadow", 0);
    assert.equal(await persistence.start(), true);
    const [first, second] = await Promise.all([persistence.periodicParity(), persistence.periodicParity()]);
    assert.ok(first);
    assert.equal(second, null);
  });

  it("closing stops the schedule", async () => {
    const persistence = start("shadow", "shadow", 10);
    assert.equal(await persistence.start(), true);
    await persistence.close();
    const atClose = persistence.status().parity?.checkedAt;
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.equal(persistence.status().parity?.checkedAt, atClose);
  });
});
