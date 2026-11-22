import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
import type { SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-safeguards-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
delete process.env.DATABASE_URL;

/**
 * Safeguards for the move to PostgreSQL that make a bad hand-over, a bad record or silent drift
 * visible and harmless: PostgreSQL does not take charge while it would be missing data, one
 * rejected record is not treated as an outage, and drift is counted and then repaired.
 */
describe("PostgreSQL move: hand-over guard, rejected records and drift repair", async () => {
  const { readDb, writeDb } = await import("@/lib/db");
  const { DatabaseUnavailableError, isConnectionError, isDataError } = await import("@/lib/persistence/sql-client");
  const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("./json-repositories");
  const { Persistence } = await import("./persistence");
  const { replacePersistenceForTests } = await import("./index");
  const { createPgliteClient, subscription, withOutageSwitch } = await import("./test-support");

  let database: SqlClient;
  let switched: SqlClient & { down: boolean };
  let now = Date.now();
  const open: Array<InstanceType<typeof Persistence>> = [];
  const logs: string[] = [];

  function memoryMarker(initial: "json" | "postgres" = "json") {
    const marker = {
      value: initial,
      read: () => marker.value,
      write: (value: "json" | "postgres") => {
        marker.value = value;
      },
    };
    return marker;
  }

  const modes = (ledger: StoreMode, subscriptions: StoreMode): PersistenceModes => ({ ledger, subscriptions, warnings: [] });
  function start(ledger: StoreMode, subscriptions: StoreMode, extra: Record<string, unknown> = {}) {
    const instance = new Persistence({
      modes: modes(ledger, subscriptions),
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      connect: async () => {
        if (switched.down) throw new Error("connect ECONNREFUSED");
        return { ...switched, query: switched.query, exec: switched.exec, transaction: switched.transaction, close: async () => undefined };
      },
      clock: () => now,
      retryAfterMs: 1_000,
      recheckAfterMs: 1,
      parityEveryMs: 0,
      log: (message) => logs.push(message),
      ...extra,
    }).activate();
    open.push(instance);
    return instance;
  }
  const seedDataFile = (...records: RevenueSubscriptionRecord[]) =>
    writeDb((db) => {
      db.revenueSubscriptions.push(...records);
    });
  const inDataFile = () => readDb().revenueSubscriptions;
  const postgresIds = async () =>
    (await database.query<{ id: string }>("select id from revenue_subscriptions order by id")).rows.map((row) => row.id);
  const postgresLedger = async () =>
    (await database.query<{ zip: string }>("select distinct zip from zip_claims where released_at is null order by zip")).rows.map((row) => row.zip);
  const authorityInPostgres = async () =>
    (await database.query<{ value: string }>("select value from persistence_state where key = 'authority'")).rows[0]?.value;

  before(async () => {
    database = await createPgliteClient();
    switched = withOutageSwitch(database);
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });
  afterEach(async () => {
    for (const instance of open.splice(0)) await instance.close();
    await replacePersistenceForTests(null);
    switched.down = false;
    logs.length = 0;
    now = Date.now();
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
    await database.exec("drop table if exists zip_claims, revenue_subscriptions, persistence_state, schema_migrations cascade");
  });
  after(async () => {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("PostgreSQL does not take charge while a ZIP code claim from the data file was refused", async () => {
    // Old data: two different officers both listed as holding 93618. The data file never stopped that.
    const first = subscription({ claimedZips: ["93618"] });
    const second = subscription({ claimedZips: ["93618", "93291"] });
    seedDataFile(first, second);

    const shadow = start("shadow", "shadow");
    assert.equal(await shadow.start(), true);
    assert.equal(shadow.status().refusedClaims, 1, "the shadow step already reports it");
    assert.equal(shadow.status().handoverBlocked, false, "the data file decides in shadow, so nothing is blocked");
    await shadow.close();

    now += 20_000;
    const marker = memoryMarker();
    const takeover = start("postgres", "postgres", { authorityMarker: marker });
    assert.equal(await takeover.start(), false);
    const status = takeover.status();
    assert.equal(status.handoverBlocked, true);
    assert.equal(status.ready, false);
    assert.equal(status.refusedClaims, 1);
    assert.ok(logs.some((line) => line.includes("hand-over to PostgreSQL refused")));
    // PostgreSQL never became the store in charge, and the data file's note says the same.
    assert.notEqual(await authorityInPostgres(), "postgres");
    assert.equal(marker.value, "json");
    // Payment events wait (Stripe redelivers them) instead of being decided on incomplete data.
    await assert.rejects(takeover.subscriptions.saveWithZipClaim(subscription(), "93277"), DatabaseUnavailableError);
    assert.equal(inDataFile().length, 2, "nothing was written anywhere");

    // A person fixes the data (the second plan gives up the ZIP code) and the switch goes through.
    writeDb((db) => {
      const record = db.revenueSubscriptions.find((item) => item.id === second.id);
      if (record) record.claimedZips = ["93291"];
    });
    now += 20_000;
    assert.equal(await takeover.start(), true);
    assert.equal(takeover.status().handoverBlocked, false);
    assert.equal(await authorityInPostgres(), "postgres");
    assert.equal(marker.value, "postgres");
    assert.equal((await takeover.checkParity())?.clean, true);
    assert.deepEqual(await postgresLedger(), ["93291", "93618"]);
  });

  it("PostgreSQL does not take charge while a plan could not be copied, and going back to shadow owes nothing", async () => {
    const good = subscription({ claimedZips: ["93618"] });
    const bad = subscription({ createdAt: "not a date" });
    seedDataFile(bad, good);

    const marker = memoryMarker();
    const takeover = start("postgres", "postgres", { authorityMarker: marker });
    assert.equal(await takeover.start(), false);
    assert.equal(takeover.status().handoverBlocked, true);
    assert.equal(takeover.status().unstorableRecords, 1);
    assert.deepEqual(await postgresIds(), [good.id], "the rest was copied");
    await takeover.close();

    // Back to shadow: the data file was the truth all along, so its payments are not held up.
    now += 20_000;
    const shadow = start("shadow", "shadow", { authorityMarker: marker });
    assert.equal(await shadow.start(), true);
    assert.equal(shadow.status().handoverBlocked, false);
    assert.equal((await shadow.subscriptions.saveWithZipClaim(subscription(), "93291")).zipClaimed, true);
  });

  it("drift is counted and then repaired while running, whichever store is in charge", async () => {
    const shadow = start("shadow", "shadow");
    await shadow.start();
    const first = await shadow.subscriptions.saveWithZipClaim(subscription({ company: "Valley Home Loans" }), "93618");
    assert.equal((await shadow.periodicParity())?.clean, true);
    assert.equal(shadow.status().driftDetected, 0);

    // PostgreSQL loses a ZIP code lock and changes a field behind the app's back.
    await database.query("delete from zip_claims where subscription_id = $1", [first.record.id]);
    await database.query("update revenue_subscriptions set company = 'Changed' where id = $1", [first.record.id]);
    const repaired = await shadow.periodicParity();
    assert.equal(repaired?.clean, true, "copied again from the data file");
    assert.equal(shadow.status().driftDetected, 2, "one changed record and one missing ZIP code lock");
    assert.deepEqual(await postgresLedger(), ["93618"]);
    assert.ok(logs.some((line) => line.includes("drifted apart")));
    await shadow.close();

    // Now PostgreSQL is in charge and the data file's copy (the rollback target) goes wrong.
    now += 20_000;
    const postgres = start("postgres", "postgres");
    assert.equal(await postgres.start(), true);
    writeDb((db) => {
      const record = db.revenueSubscriptions.find((item) => item.id === first.record.id);
      if (record) record.claimedZips = [];
    });
    assert.equal((await postgres.periodicParity())?.clean, true, "copied again from PostgreSQL");
    assert.deepEqual(inDataFile().find((record) => record.id === first.record.id)?.claimedZips, ["93618"]);
    assert.ok(postgres.status().driftDetected >= 1);
  });

  it("a plan only the other store holds is not deleted by the repair; it stays reported for a person", async () => {
    const shadow = start("shadow", "shadow");
    await shadow.start();
    const kept = await shadow.subscriptions.saveWithZipClaim(subscription(), "93618");
    const stray = subscription({ claimedZips: [] });
    await shadow.subscriptions.save(stray);
    writeDb((db) => {
      db.revenueSubscriptions = db.revenueSubscriptions.filter((record) => record.id !== stray.id);
    });

    const report = await shadow.periodicParity();
    assert.equal(report?.clean, false);
    assert.deepEqual(report?.subscriptions.onlyInPostgres, [stray.id]);
    assert.deepEqual(await postgresIds(), [kept.record.id, stray.id].sort());
    assert.ok(logs.some((line) => line.includes("could not fix")));
  });

  it("a record the database rejects is not an outage: the next payment goes straight through", async () => {
    const persistence = start("postgres", "postgres");
    assert.equal(await persistence.start(), true);
    const bad = { ...subscription(), status: "paused" } as unknown as RevenueSubscriptionRecord;
    await assert.rejects(persistence.subscriptions.save(bad));
    assert.equal(persistence.status().ready, true, "still connected");

    assert.equal((await persistence.subscriptions.saveWithZipClaim(subscription(), "93618")).zipClaimed, true);
    const latency = persistence.status().latency;
    assert.ok(latency.postgresWrite.count >= 1 && latency.mirror.count >= 1);
    assert.ok(latency.postgresWrite.maxMs >= latency.postgresWrite.avgMs);
  });

  it("a lost connection still counts as an outage", async () => {
    const persistence = start("postgres", "postgres");
    assert.equal(await persistence.start(), true);
    switched.down = true;
    await assert.rejects(persistence.subscriptions.saveWithZipClaim(subscription(), "93618"), DatabaseUnavailableError);
    assert.equal(persistence.status().ready, false);
    assert.ok(persistence.status().writeFailures >= 1);

    assert.equal(isConnectionError(Object.assign(new Error("x"), { code: "ECONNRESET" })), true);
    assert.equal(isConnectionError(Object.assign(new Error("x"), { code: "08006" })), true);
    assert.equal(isConnectionError(Object.assign(new Error("x"), { code: "23505" })), false);
    assert.equal(isDataError(Object.assign(new Error("x"), { code: "23505" })), true);
    assert.equal(isDataError(Object.assign(new Error("x"), { code: "22007" })), true);
    assert.equal(isDataError(new Error("Connection terminated unexpectedly")), false);
  });

  it("two plan records for one Stripe subscription are counted in the status", async () => {
    const original = subscription({ stripeSubscriptionId: "sub_dup_1" });
    const duplicate = subscription({ stripeSubscriptionId: "sub_dup_1", claimedZips: [] });
    seedDataFile(original, duplicate, subscription());
    const shadow = start("shadow", "shadow");
    await shadow.start();
    await shadow.checkParity();
    assert.equal(shadow.status().duplicateStripeSubscriptions, 1);
  });
});
