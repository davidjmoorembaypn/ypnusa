import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
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
  function start(ledger: StoreMode, subscriptions: StoreMode) {
    const instance = new Persistence({
      modes: modes(ledger, subscriptions),
      json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
      // The connection is shared by the test, so closing an instance must not close it.
      connect: async () => {
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

    const again = await persistence.synchronise("json");
    assert.deepEqual({ copied: again.copied, unchanged: again.unchanged, failed: again.failed }, { copied: 0, unchanged: 3, failed: [] });
    assert.equal(persistence.status().parity?.mismatches, 0);
  });

  it("shadow: the data file decides, and every write also lands in PostgreSQL", async () => {
    const persistence = start("shadow", "shadow");
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
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");

    switched.down = true;
    const during = await persistence.subscriptions.saveWithZipClaim(subscription(), "93291");
    assert.equal(during.zipClaimed, true);
    assert.equal(inDataFile().length, 2);
    assert.equal(persistence.status().mirrorFailures, 1);
    assert.equal((await inPostgresWhileDown()).length, 1);

    switched.down = false;
    now += 5_000;
    await persistence.subscriptions.saveWithZipClaim(subscription(), "93277");
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

  it("two holders of one ZIP code in old data: the first keeps it, and the second is reported for a person", async () => {
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
    // Both stores still say the same thing to a visitor: both ZIP codes are taken.
    assert.equal((await persistence.checkParity())?.clean, true);
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
