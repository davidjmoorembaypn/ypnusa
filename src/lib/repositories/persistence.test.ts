import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
import type { Authority, AuthorityMarker } from "./persistence";
import type { SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-persistence-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("moving subscriptions and the ZIP code ledger from the data file to PostgreSQL", async () => {
  const { readDb, writeDb } = await import("@/lib/db");
  const { paidLedgerClaimedZips } = await import("@/lib/territory");
  const { DatabaseUnavailableError } = await import("@/lib/persistence/sql-client");
  const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("./json-repositories");
  const { Persistence } = await import("./persistence");
  const { replacePersistenceForTests } = await import("./index");
  const { createPgliteClient, subscription, withOutageSwitch } = await import("./test-support");

  let database: SqlClient;
  let switched: SqlClient & { down: boolean };
  let now = Date.now();
  const open: Array<InstanceType<typeof Persistence>> = [];
  const logs: string[] = [];

  const modes = (ledger: StoreMode, subscriptions: StoreMode): PersistenceModes => ({ ledger, subscriptions, warnings: [] });
  // The note beside the data file that survives a restart: shared by every instance in a test.
  let markerValue: { authority: Authority; forced?: boolean } | null = null;
  const marker: AuthorityMarker = { read: () => markerValue, write: (value) => void (markerValue = value) };
  function start(ledger: StoreMode, subscriptions: StoreMode, options: { acceptDataFileAsTruth?: boolean; configured?: boolean } = {}) {
    const instance = new Persistence({
      modes: modes(ledger, subscriptions),
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      localAuthority: marker,
      acceptDataFileAsTruth: options.acceptDataFileAsTruth,
      parityEveryMs: 0,
      // The connection is shared by the test, so closing an instance must not close it.
      connect: options.configured === false ? null : async () => {
        if (switched.down) throw new Error("connect ECONNREFUSED");
        return { ...switched, query: switched.query, exec: switched.exec, transaction: switched.transaction, close: async () => undefined };
      },
      clock: () => now,
      retryAfterMs: 1_000,
      recheckAfterMs: 1,
      log: (message) => logs.push(message),
    }).activate();
    open.push(instance);
    return instance;
  }
  const inDataFile = () => readDb().revenueSubscriptions;
  const inPostgres = async () =>
    (await database.query<{ id: string; claimed_zips: string[]; status: string }>("select id, claimed_zips, status from revenue_subscriptions order by id")).rows;
  const postgresLedger = async () =>
    (await database.query<{ zip: string }>("select distinct zip from zip_claims where released_at is null order by zip")).rows.map((row) => row.zip);
  const seedDataFile = (...records: RevenueSubscriptionRecord[]) =>
    writeDb((db) => {
      db.revenueSubscriptions.push(...records);
    });

  before(async () => {
    database = await createPgliteClient();
    switched = withOutageSwitch(database);
    // A new data file starts with three made-up demo subscriptions: start from none.
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
  });
  afterEach(async () => {
    for (const instance of open.splice(0)) await instance.close();
    await replacePersistenceForTests(null);
    switched.down = false;
    logs.length = 0;
    markerValue = null;
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

  it("json mode: a configured database gets its tables but no data, and answers nothing", async () => {
    const persistence = start("json", "json");
    assert.equal(await persistence.start(), true);
    const outcome = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(outcome.zipClaimed, true);
    assert.equal(inDataFile().length, 1);
    assert.deepEqual(await inPostgres(), []);
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
    const status = persistence.status();
    assert.deepEqual(
      { configured: status.configured, ready: status.ready, ledger: status.ledger, subscriptions: status.subscriptions, parity: status.parity },
      { configured: true, ready: true, ledger: "json", subscriptions: "json", parity: null },
    );
  });

  it("with no database configured nothing changes and nothing is attempted", async () => {
    const persistence = new Persistence({
      modes: modes("json", "json"),
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      connect: null,
    }).activate();
    open.push(persistence);
    assert.equal(await persistence.start(), false);
    await persistence.subscriptions.save(subscription({ claimedZips: ["93618"] }));
    assert.equal(inDataFile().length, 1);
    assert.equal(persistence.status().configured, false);
    assert.equal(await persistence.checkParity(), null);
  });

  it("shadow: what is already in the data file is copied at start, and copying again changes nothing", async () => {
    seedDataFile(
      subscription({ claimedZips: ["93618"] }),
      subscription({ status: "cancelled", claimedZips: ["93291"] }),
      subscription({ status: "trialing", pendingZip: "93277" }),
    );
    const persistence = start("shadow", "shadow");
    assert.equal(await persistence.start(), true);
    assert.equal((await inPostgres()).length, 3);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    assert.equal((await persistence.checkParity())?.clean, true);
    // The first copy into an empty database is expected, not drift.
    assert.equal(persistence.status().driftDetected, 0);

    const again = await persistence.synchronise("json");
    assert.deepEqual({ copied: again.copied, unchanged: again.unchanged, failed: again.failed }, { copied: 0, unchanged: 3, failed: [] });
    assert.equal(persistence.status().parity?.mismatches, 0);

    // After a restart, a difference that appeared while the server was off IS drift.
    await persistence.close();
    await database.query("update revenue_subscriptions set company = 'Changed while off'");
    now += 20_000;
    const restarted = start("shadow", "shadow");
    assert.equal(await restarted.start(), true);
    assert.equal(restarted.status().driftDetected, 3);
    assert.equal(restarted.status().parity?.clean, true);
  });

  it("shadow: the data file decides, and every write also lands in PostgreSQL", async () => {
    const persistence = start("shadow", "shadow");
    await persistence.start();
    const first = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    const second = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(first.zipClaimed, true);
    assert.equal(second.zipConflict, true);
    await persistence.subscriptions.save({ ...first.record, status: "cancelled" });

    assert.deepEqual(
      await inPostgres(),
      [
        { id: first.record.id, claimed_zips: ["93618"], status: "cancelled" },
        { id: second.record.id, claimed_zips: [], status: "active" },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    assert.deepEqual(await postgresLedger(), []);
    assert.equal((await persistence.checkParity())?.clean, true);
    assert.equal(persistence.status().mirrorFailures, 0);
    // Availability still comes from the data file in shadow mode.
    assert.deepEqual([...paidLedgerClaimedZips()], []);
  });

  it("shadow: a database outage never fails a payment, and the missed writes are re-copied", async () => {
    const persistence = start("shadow", "shadow");
    await persistence.start();
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");

    switched.down = true;
    const during = await persistence.subscriptions.saveWithZipClaim(subscription(), "93291");
    assert.equal(during.zipClaimed, true);
    assert.equal(inDataFile().length, 2);
    assert.equal(persistence.status().mirrorFailures, 1);
    assert.equal((await inPostgresWhileDown()).length, 1);

    switched.down = false;
    now += 5_000;
    // The payment does not wait for the database to come back; the reconnect copies everything.
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93277");
    assert.equal(await persistence.start(), true);
    await persistence.maintain();
    assert.equal((await inPostgres()).length, 3);
    assert.deepEqual(await postgresLedger(), ["93277", "93291", "93618"]);
    assert.equal((await persistence.checkParity())?.clean, true);

    async function inPostgresWhileDown() {
      return (await database.query("select id from revenue_subscriptions")).rows;
    }
  });

  it("shadow: a database that is down at start is retried later, not on every request", async () => {
    switched.down = true;
    const persistence = start("shadow", "shadow");
    assert.equal(await persistence.start(), false);
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(persistence.status().ready, false);

    switched.down = false;
    // Too soon: no new attempt yet.
    assert.equal(await persistence.start(), false);
    now += 5_000;
    assert.equal(await persistence.start(), true);
    assert.equal((await inPostgres()).length, 1);
    assert.equal((await persistence.checkParity())?.clean, true);
  });

  it("shadow: a subscription that differs between the stores is noticed on read", async () => {
    const persistence = start("shadow", "shadow");
    await persistence.start();
    const saved = await persistence.subscriptions.saveWithZipClaim(subscription({ company: "Valley Home Loans" }), "93618");
    await database.query("update revenue_subscriptions set company = 'Someone Else' where id = $1", [saved.record.id]);

    const found = await persistence.subscriptions.findByStripeSubscriptionId(saved.record.stripeSubscriptionId as string);
    assert.equal(found?.company, "Valley Home Loans");
    await persistence.settle();
    assert.equal(persistence.status().readMismatches, 1);
    const parity = await persistence.checkParity();
    assert.equal(parity?.clean, false);
    assert.deepEqual(parity?.subscriptions.different, [{ id: saved.record.id, fields: ["company"] }]);
  });

  it("ledger first: ZIP code checks answer from PostgreSQL while the data file still decides payments", async () => {
    const persistence = start("postgres", "shadow");
    await persistence.start();
    const first = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);

    // Proof the answer is PostgreSQL's: release the claim there only.
    await database.query("update zip_claims set released_at = now(), release_reason = 'removed' where subscription_id = $1", [first.record.id]);
    now += 11_000;
    paidLedgerClaimedZips(); // older than the refresh interval: serves the copy it has and reloads
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual([...paidLedgerClaimedZips()], []);
    assert.deepEqual([...(await persistence.ledger.paidClaimedZips())], []);

    // The database goes away: once the copy is too old, the data file answers again.
    switched.down = true;
    now += 10 * 60_000;
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
    assert.ok(persistence.status().ledgerFallbacks >= 1);
    assert.deepEqual([...(await persistence.ledger.paidClaimedZips())], ["93618"]);
  });

  it("postgres: PostgreSQL decides, and the data file receives a copy of every write", async () => {
    const persistence = start("postgres", "postgres");
    const first = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    const second = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(first.zipClaimed, true);
    assert.equal(second.zipConflict, true);
    assert.deepEqual(
      inDataFile()
        .map((record) => ({ id: record.id, claimedZips: record.claimedZips }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: first.record.id, claimedZips: ["93618"] },
        { id: second.record.id, claimedZips: [] },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
    assert.equal((await persistence.checkParity())?.clean, true);
    assert.equal((await persistence.subscriptions.findById(first.record.id))?.id, first.record.id);
    const { rows } = await database.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    assert.equal(rows[0].value, "postgres");
  });

  it("postgres: while the database is down a payment event is refused (to be redelivered), and nothing is half-written", async () => {
    const persistence = start("postgres", "postgres");
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");

    switched.down = true;
    const blocked = subscription();
    await assert.rejects(persistence.subscriptions.saveWithZipClaim(blocked, "93291"), DatabaseUnavailableError);
    await assert.rejects(persistence.subscriptions.findByStripeSubscriptionId("stripe_sub_x"), DatabaseUnavailableError);
    assert.equal(inDataFile().some((record) => record.id === blocked.id), false);
    assert.equal(persistence.status().writeFailures, 2);
    // Visitors can still check a ZIP code.
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);

    // The redelivered event succeeds once the database is back.
    switched.down = false;
    now += 5_000;
    const retried = await persistence.subscriptions.saveWithZipClaim(blocked, "93291");
    assert.equal(retried.zipClaimed, true);
    assert.equal((await persistence.checkParity())?.clean, true);
  });

  it("switching store in either direction first copies everything from the store that was in charge", async () => {
    // 1. Shadow, and the database misses a write.
    const shadow = start("shadow", "shadow");
    await shadow.start();
    switched.down = true;
    const missed = await shadow.subscriptions.saveWithZipClaim(subscription(), "93618");
    switched.down = false;
    assert.deepEqual(await inPostgres(), []);
    await shadow.close();

    // 2. PostgreSQL takes over: the missed write is copied before it decides anything.
    now += 5_000;
    const postgres = start("postgres", "postgres");
    assert.equal(await postgres.start(), true);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    const rival = await postgres.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(rival.zipConflict, true);
    const added = await postgres.subscriptions.saveWithZipClaim(subscription(), "93291");
    // The data file's copy of that last write is lost.
    writeDb((db) => {
      db.revenueSubscriptions = db.revenueSubscriptions.filter((record) => record.id !== added.record.id);
    });
    await postgres.close();

    // 3. Rolling back: the data file gets what only PostgreSQL had, then decides again.
    now += 5_000;
    const rolledBack = start("shadow", "shadow");
    assert.equal(await rolledBack.start(), true);
    assert.deepEqual(
      inDataFile().map((record) => record.id).sort(),
      [missed.record.id, rival.record.id, added.record.id].sort(),
    );
    assert.equal((await rolledBack.checkParity())?.clean, true);
    const { rows } = await database.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    assert.equal(rows[0].value, "json");
    assert.deepEqual([...paidLedgerClaimedZips()].sort(), ["93291", "93618"]);
  });

  it("two holders of one ZIP code in old data: the first keeps it, and it is reported until a person fixes it", async () => {
    const first = subscription({ claimedZips: ["93618"] });
    const second = subscription({ claimedZips: ["93618", "93291"] });
    seedDataFile(first, second);
    const persistence = start("shadow", "shadow");
    await persistence.start();
    assert.ok(logs.some((line) => line.includes("refusedClaims") && line.includes(second.id)));

    const report = await persistence.synchronise("json", true);
    assert.deepEqual(report.refusedClaims, [{ subscriptionId: second.id, zip: "93618" }]);
    const { rows } = await database.query<{ zip: string; subscription_id: string }>(
      "select zip, subscription_id from zip_claims where released_at is null order by zip",
    );
    assert.deepEqual(rows, [
      { zip: "93291", subscription_id: second.id },
      { zip: "93618", subscription_id: first.id },
    ]);
    // A visitor gets the same answer from both stores (taken), but the stores do not agree on
    // who holds it, so the comparison is not clean and the health check says so.
    const parity = await persistence.checkParity();
    assert.equal(parity?.clean, false);
    assert.deepEqual(parity?.ledger.onlyInDataFile, [`93618 ${second.stripeCustomerId}`]);
    assert.equal(persistence.status().refusedClaims, 1);

    // PostgreSQL may not take over while it would be missing a claim the data file has.
    await persistence.close();
    now += 20_000;
    const takeover = start("postgres", "postgres");
    assert.equal(await takeover.start(), false);
    assert.equal(takeover.status().handoverBlocked, true);
    await assert.rejects(takeover.subscriptions.saveWithZipClaim(subscription(), "93277"), DatabaseUnavailableError);
    const { rows: state } = await database.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    assert.notEqual(state[0]?.value, "postgres");

    // Once a person fixes the data (the second plan gives up the ZIP code), the switch goes through.
    writeDb((db) => {
      const record = db.revenueSubscriptions.find((item) => item.id === second.id);
      if (record) record.claimedZips = ["93291"];
    });
    now += 20_000;
    assert.equal(await takeover.start(), true);
    assert.equal(takeover.status().handoverBlocked, false);
    assert.equal((await takeover.checkParity())?.clean, true);
  });

  it("a record PostgreSQL cannot hold is reported and does not stop the rest", async () => {
    const good = subscription({ claimedZips: ["93618"] });
    const bad = subscription({ createdAt: "not a date" });
    seedDataFile(bad, good);
    const persistence = start("shadow", "shadow");
    assert.equal(await persistence.start(), true);
    assert.deepEqual((await inPostgres()).map((row) => row.id), [good.id]);
    const parity = await persistence.checkParity();
    assert.equal(parity?.clean, false);
    assert.deepEqual(parity?.subscriptions.onlyInDataFile, [bad.id]);
  });

  // ---- found by review: start-up, rollback and concurrent events ----------------------------

  const within = <T,>(work: Promise<T>, what: string, ms = 4_000): Promise<T> =>
    Promise.race([work, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} did not finish`)), ms).unref())]);

  it("a ZIP code check that arrives while the database is starting does not stall start-up or payments", async () => {
    seedDataFile(subscription({ claimedZips: ["93618"] }));
    const persistence = start("postgres", "postgres");
    const starting = persistence.start();
    // A page view lands mid-start: it must be answered at once (from the data file's copy)...
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
    // ...and must not leave start-up and the ledger reload waiting on each other.
    assert.equal(await within(starting, "start-up"), true);
    const outcome = await within(persistence.subscriptions.saveWithZipClaim(subscription(), "93291"), "the payment");
    assert.equal(outcome.zipClaimed, true);
    assert.deepEqual([...paidLedgerClaimedZips()].sort(), ["93291", "93618"]);

    // The same when a page view is what triggers the reconnect after an outage.
    switched.down = true;
    await assert.rejects(persistence.subscriptions.saveWithZipClaim(subscription(), "93277"), DatabaseUnavailableError);
    switched.down = false;
    now += 11_000;
    paidLedgerClaimedZips();
    const after = await within(persistence.subscriptions.saveWithZipClaim(subscription(), "93277"), "the payment after the outage");
    assert.equal(after.zipClaimed, true);
    assert.deepEqual([...paidLedgerClaimedZips()].sort(), ["93277", "93291", "93618"]);
  });

  it("rolling back during a database outage: the data file takes no payment writes until PostgreSQL's copy is back", async () => {
    const postgres = start("postgres", "postgres");
    const held = await postgres.subscriptions.saveWithZipClaim(subscription(), "93618");
    await postgres.close();

    // The database goes down and the operator rolls back one step.
    switched.down = true;
    now += 20_000;
    const rolledBack = start("postgres", "shadow");
    assert.equal(await rolledBack.start(), false);
    assert.equal(rolledBack.status().handoverPending, true);
    // The data file's copy may be older than PostgreSQL's, so it must not decide anything yet.
    await assert.rejects(rolledBack.subscriptions.save({ ...held.record, status: "cancelled" }), DatabaseUnavailableError);
    await assert.rejects(rolledBack.subscriptions.saveWithZipClaim(subscription(), "93618"), DatabaseUnavailableError);
    assert.equal(inDataFile().find((record) => record.id === held.record.id)?.status, "active");
    // Visitors still get an answer.
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);

    // The database returns: its copy is brought over first, then the data file decides again.
    switched.down = false;
    now += 20_000;
    assert.equal(await rolledBack.start(), true);
    assert.equal(rolledBack.status().handoverPending, false);
    await rolledBack.subscriptions.save({ ...held.record, status: "cancelled" });
    const next = await rolledBack.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(next.zipClaimed, true);
    await rolledBack.maintain();
    assert.equal(rolledBack.status().parity?.clean, true);
    assert.equal(inDataFile().find((record) => record.id === held.record.id)?.status, "cancelled");
    assert.deepEqual(await postgresLedger(), ["93618"]);
    const holders = await database.query<{ subscription_id: string }>("select subscription_id from zip_claims where zip = '93618' and released_at is null");
    assert.deepEqual(holders.rows.map((row) => row.subscription_id), [next.record.id]);
  });

  it("declaring the data file the truth: its newer writes are kept when the database comes back", async () => {
    const postgres = start("postgres", "postgres");
    const held = await postgres.subscriptions.saveWithZipClaim(subscription(), "93618");
    await postgres.close();

    switched.down = true;
    now += 20_000;
    const forced = start("shadow", "shadow", { acceptDataFileAsTruth: true });
    assert.equal(forced.status().handoverPending, false);
    await forced.subscriptions.save({ ...held.record, status: "cancelled" });
    const next = await forced.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(next.zipClaimed, true);

    // PostgreSQL still says the first plan is active and holds the ZIP code. It must not win.
    switched.down = false;
    now += 20_000;
    assert.equal(await forced.start(), true);
    await forced.maintain();
    assert.equal(inDataFile().find((record) => record.id === held.record.id)?.status, "cancelled");
    const rows = await inPostgres();
    assert.equal(rows.find((row) => row.id === held.record.id)?.status, "cancelled");
    const holders = await database.query<{ subscription_id: string }>("select subscription_id from zip_claims where zip = '93618' and released_at is null");
    assert.deepEqual(holders.rows.map((row) => row.subscription_id), [next.record.id]);
    assert.equal(forced.status().parity?.clean, true);
    const { rows: state } = await database.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    assert.equal(state[0].value, "json");
  });

  it("removing the database setting after PostgreSQL was in charge needs the same explicit decision", async () => {
    const postgres = start("postgres", "postgres");
    await postgres.subscriptions.saveWithZipClaim(subscription(), "93618");
    await postgres.close();

    const removed = start("json", "json", { configured: false });
    assert.equal(removed.status().handoverPending, true);
    await assert.rejects(removed.subscriptions.saveWithZipClaim(subscription(), "93291"), DatabaseUnavailableError);
    assert.ok(logs.some((line) => line.includes("YPN_ACCEPT_DATA_FILE_AS_TRUTH")));

    const decided = start("json", "json", { configured: false, acceptDataFileAsTruth: true });
    assert.equal(decided.status().handoverPending, false);
    assert.equal((await decided.subscriptions.saveWithZipClaim(subscription(), "93291")).zipClaimed, true);
  });

  it("drift is found and repaired while running, in both directions", async () => {
    const shadow = start("shadow", "shadow");
    await shadow.start();
    const first = await shadow.subscriptions.saveWithZipClaim(subscription({ company: "Valley Home Loans" }), "93618");
    // PostgreSQL loses a ZIP code lock and changes a field behind the app's back.
    await database.query("delete from zip_claims where subscription_id = $1", [first.record.id]);
    await database.query("update revenue_subscriptions set company = 'Changed' where id = $1", [first.record.id]);
    const repaired = await shadow.maintain();
    assert.equal(repaired?.clean, true);
    assert.equal(shadow.status().driftDetected, 2);
    assert.ok(Date.parse(shadow.status().parity?.checkedAt ?? "") > 0);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    assert.ok(logs.some((line) => line.includes("the stores differ")));
    await shadow.close();

    now += 20_000;
    const postgres = start("postgres", "postgres");
    await postgres.start();
    // Now PostgreSQL is in charge and the data file's copy goes wrong.
    writeDb((db) => {
      const record = db.revenueSubscriptions.find((item) => item.id === first.record.id);
      if (record) record.claimedZips = [];
    });
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"], "ZIP code checks come from PostgreSQL, so visitors are unaffected");
    assert.equal((await postgres.maintain())?.clean, true);
    assert.deepEqual(inDataFile().find((record) => record.id === first.record.id)?.claimedZips, ["93618"]);
    assert.ok(postgres.status().driftDetected >= 1);
  });

  it("a record the database rejects does not count as the database being down", async () => {
    const persistence = start("postgres", "postgres");
    await persistence.start();
    const bad = { ...subscription(), status: "paused" } as unknown as RevenueSubscriptionRecord;
    await assert.rejects(persistence.subscriptions.save(bad), DatabaseUnavailableError);
    assert.equal(persistence.status().ready, true);
    // The next payment goes straight through, with no reconnect wait.
    assert.equal((await persistence.subscriptions.saveWithZipClaim(subscription(), "93618")).zipClaimed, true);
    const latency = persistence.status().latency;
    assert.ok(latency.postgresWrite.count >= 1 && latency.mirror.count >= 1);
    assert.ok(latency.postgresWrite.maxMs >= latency.postgresWrite.avgMs);
  });

  it("two Stripe events for one subscription arriving together create one record, not two", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    await persistence.start();
    const { applyFulfillmentEvent, lockZipOnPaidInvoice } = await import("@/lib/fulfillment");
    const base = { stripeCustomerId: "cus_race", stripeSubscriptionId: "sub_race", tier: "growth", customerEmail: "race@example.com" };
    const [checkout, created] = await Promise.all([
      applyFulfillmentEvent({ ...base, zip: "93618", eventType: "checkout.session.completed", paymentStatus: "no_payment_required", eventCreatedAt: 1_900_000_100, eventId: "evt_checkout" }),
      applyFulfillmentEvent({ ...base, eventType: "customer.subscription.created", subscriptionStatus: "trialing", eventCreatedAt: 1_900_000_100, eventId: "evt_created" }),
    ]);
    assert.equal(checkout.ok && created.ok, true);
    const rows = await database.query<{ id: string }>("select id from revenue_subscriptions where stripe_subscription_id = 'sub_race'");
    assert.equal(rows.rows.length, 1);
    assert.equal(inDataFile().filter((record) => record.stripeSubscriptionId === "sub_race").length, 1);

    // The first paid invoice and a subscription update arriving together: the lock must survive.
    await Promise.all([
      lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_race", amountPaidCents: 9900, invoiceStatus: "paid" }),
      applyFulfillmentEvent({ ...base, eventType: "customer.subscription.updated", subscriptionStatus: "active", eventCreatedAt: 1_900_000_200, eventId: "evt_updated" }),
    ]);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    assert.deepEqual((await persistence.subscriptions.findByStripeSubscriptionId("sub_race"))?.claimedZips, ["93618"]);

    await applyFulfillmentEvent({ ...base, eventType: "customer.subscription.deleted", eventCreatedAt: 1_900_000_300, eventId: "evt_deleted" });
    const live = await database.query("select 1 from revenue_subscriptions where stripe_subscription_id = 'sub_race' and status <> 'cancelled'");
    assert.equal(live.rows.length, 0);
    assert.deepEqual(await postgresLedger(), []);
    assert.equal((await persistence.maintain())?.clean, true);
  });

  it("the note beside the data file survives a restart and fails safe when it cannot be read", async () => {
    const { AUTHORITY_MARKER_FILE, fileAuthorityMarker } = await import("./index");
    const file = fileAuthorityMarker(dataDir);
    assert.equal(file.read(), null);
    file.write({ authority: "postgres" });
    assert.deepEqual(fileAuthorityMarker(dataDir).read(), { authority: "postgres" });
    file.write({ authority: "json", forced: true });
    assert.deepEqual(fileAuthorityMarker(dataDir).read(), { authority: "json", forced: true });
    fs.writeFileSync(path.join(dataDir, AUTHORITY_MARKER_FILE), "{ not json");
    const consoleError = console.error;
    console.error = () => undefined;
    try {
      assert.deepEqual(fileAuthorityMarker(dataDir).read(), { authority: "postgres" });
    } finally {
      console.error = consoleError;
    }
    fs.rmSync(path.join(dataDir, AUTHORITY_MARKER_FILE));
  });

  it("the payment webhook path uses whichever store is configured", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0; // replacePersistenceForTests closes it in afterEach
    const { applyFulfillmentEvent, lockZipOnPaidInvoice } = await import("@/lib/fulfillment");
    const { claimReplacementZip } = await import("@/lib/zip-availability");
    let created = 1_900_000_000;
    const checkout = (sub: string, customer: string, zip: string, paymentStatus: "paid" | "no_payment_required" = "paid") =>
      applyFulfillmentEvent({
        stripeCustomerId: customer,
        stripeSubscriptionId: sub,
        zip,
        eventType: "checkout.session.completed",
        paymentStatus,
        tier: "growth",
        customerEmail: `${customer}@example.com`,
        eventCreatedAt: (created += 1),
        eventId: `evt_${created}`,
      });

    const first = await checkout("sub_first", "cus_first", "93618");
    const second = await checkout("sub_second", "cus_second", "93618");
    assert.equal(first.ok && first.applied && first.zipClaimed, true);
    assert.equal(second.ok && second.applied && second.zipConflict, true);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    const flagged = (await persistence.subscriptions.findByStripeSubscriptionId("sub_second")) as RevenueSubscriptionRecord;
    assert.equal(flagged.zipLockConflict?.zip, "93618");

    // The officer who lost the race picks an open ZIP code from the dashboard.
    assert.deepEqual(await claimReplacementZip({ email: "cus_second@example.com" }, "93618"), {
      ok: false,
      reason: "taken",
      nearby: [],
    });
    assert.deepEqual(await claimReplacementZip({ email: "cus_second@example.com" }, "93291"), { ok: true, zip: "93291" });

    // A trial holds nothing until its first paid invoice.
    await checkout("sub_trial", "cus_trial", "93277", "no_payment_required");
    assert.deepEqual(await postgresLedger(), ["93291", "93618"]);
    const lock = await lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 9900, invoiceStatus: "paid" });
    assert.equal(lock.zipClaimed, true);
    assert.deepEqual(await postgresLedger(), ["93277", "93291", "93618"]);

    // A redelivered event is recognised from PostgreSQL's copy and not applied twice.
    const redelivered = await applyFulfillmentEvent({
      stripeCustomerId: "cus_first",
      stripeSubscriptionId: "sub_first",
      zip: "93618",
      eventType: "checkout.session.completed",
      paymentStatus: "paid",
      tier: "growth",
      eventCreatedAt: 1_900_000_001,
      eventId: "evt_1900000001",
    });
    assert.equal(redelivered.ok && redelivered.applied, false);
    assert.equal((await persistence.checkParity())?.clean, true);
    assert.deepEqual([...paidLedgerClaimedZips()].sort(), ["93277", "93291", "93618"]);
  });
});
