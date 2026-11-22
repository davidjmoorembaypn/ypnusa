import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { PersistenceModes, StoreMode } from "@/lib/persistence/mode";
import type { SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * One test per problem the code review of PR #212 found in the PostgreSQL paths. Each test
 * failed before its fix. They run on the in-process PostgreSQL engine; the races that need two
 * real connections are in postgres-concurrency.test.ts.
 */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-review-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

/** Fails instead of hanging when a promise never settles. */
function within<T>(promise: Promise<T>, ms = 3_000, what = "the call"): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

describe("PR #212 review findings", async () => {
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
  let connectDelayMs = 0;
  const open: Array<InstanceType<typeof Persistence>> = [];
  const logs: string[] = [];

  /** The data file's own note of which store was in charge last (kept in memory for the tests). */
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
        if (connectDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, connectDelayMs));
        if (switched.down) throw new Error("connect ECONNREFUSED");
        return { ...switched, query: switched.query, exec: switched.exec, transaction: switched.transaction, close: async () => undefined };
      },
      clock: () => now,
      retryAfterMs: 1_000,
      recheckAfterMs: 1,
      log: (message) => logs.push(message),
      ...extra,
    }).activate();
    open.push(instance);
    return instance;
  }
  const inDataFile = () => readDb().revenueSubscriptions;
  const onDisk = (): RevenueSubscriptionRecord[] =>
    (JSON.parse(fs.readFileSync(path.join(dataDir, "store.json"), "utf8")) as { revenueSubscriptions: RevenueSubscriptionRecord[] })
      .revenueSubscriptions;
  const postgresRow = async (id: string) =>
    (await database.query<{ status: string; claimed_zips: string[] }>("select status, claimed_zips from revenue_subscriptions where id = $1", [id]))
      .rows[0];
  const postgresLedger = async () =>
    (await database.query<{ zip: string }>("select distinct zip from zip_claims where released_at is null order by zip")).rows.map((row) => row.zip);
  const rowsForStripeSubscription = async (stripeSubscriptionId: string) =>
    (await database.query<{ id: string }>("select id from revenue_subscriptions where stripe_subscription_id = $1", [stripeSubscriptionId])).rows;

  let created = 1_900_000_000;
  const nextEvent = () => {
    created += 1;
    return { eventCreatedAt: created, eventId: `evt_${created}` };
  };

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
    connectDelayMs = 0;
    logs.length = 0;
    now = Date.now();
    fs.rmSync(path.join(dataDir, `store.json.${process.pid}.tmp`), { recursive: true, force: true });
    writeDb((db) => {
      db.revenueSubscriptions.length = 0;
    });
    await database.exec("drop table if exists zip_claims, revenue_subscriptions, persistence_state, schema_migrations cascade");
  });
  after(async () => {
    await database.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("1. a ZIP code check while the database is starting does not stall start-up or later payments", async () => {
    connectDelayMs = 30;
    const persistence = start("postgres", "postgres");
    const starting = persistence.start();
    // A visitor checks a ZIP code before start-up has finished.
    paidLedgerClaimedZips();
    // The deadlock this guards against never settles; a working start-up here also creates the
    // tables on a cold in-process database, which took 2.99 s of a 3 s budget on CI. 10 s keeps
    // the deadlock caught without failing on a slow runner.
    assert.equal(await within(starting, 10_000, "start-up"), true);
    const saved = await within(persistence.subscriptions.saveWithZipClaim(subscription(), "93618"), 3_000, "a payment after start-up");
    assert.equal(saved.zipClaimed, true);
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
  });

  it("2. a rollback while the database is down refuses payment events until the hand-over, so no cancellation is undone", async () => {
    const marker = memoryMarker();
    const live = start("postgres", "postgres", { authorityMarker: marker });
    assert.equal(await live.start(), true);
    assert.equal(marker.value, "postgres");
    const plan = await live.subscriptions.saveWithZipClaim(subscription(), "93618");
    await live.close();

    // Rolled back to shadow while the database is unreachable. A cancellation arrives.
    switched.down = true;
    now += 5_000;
    const rolledBack = start("shadow", "shadow", { authorityMarker: marker });
    assert.equal(await rolledBack.start(), false);
    const cancelled = { ...plan.record, status: "cancelled" as const };
    await assert.rejects(rolledBack.subscriptions.save(cancelled), DatabaseUnavailableError);
    await assert.rejects(rolledBack.subscriptions.findByStripeSubscriptionId(plan.record.stripeSubscriptionId as string), DatabaseUnavailableError);
    assert.equal(inDataFile().find((record) => record.id === plan.record.id)?.status, "active");

    // The database is back. Stripe redelivers the cancellation: it is applied after the hand-over and stays applied.
    switched.down = false;
    now += 5_000;
    await rolledBack.subscriptions.save(cancelled);
    assert.equal(marker.value, "json");
    assert.equal(inDataFile().find((record) => record.id === plan.record.id)?.status, "cancelled");
    assert.equal((await postgresRow(plan.record.id)).status, "cancelled");
    assert.deepEqual(await postgresLedger(), []);
    assert.deepEqual([...paidLedgerClaimedZips()], []);

    // A later restart does not bring the plan back either.
    await rolledBack.close();
    now += 5_000;
    const again = start("shadow", "shadow", { authorityMarker: marker });
    assert.equal(await again.start(), true);
    assert.equal(inDataFile().find((record) => record.id === plan.record.id)?.status, "cancelled");
  });

  it("2b. after the hand-over, a database outage in shadow mode no longer blocks payments", async () => {
    const marker = memoryMarker("postgres");
    const persistence = start("shadow", "shadow", { authorityMarker: marker });
    assert.equal(await persistence.start(), true);
    assert.equal(marker.value, "json");
    switched.down = true;
    const during = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.equal(during.zipClaimed, true);
  });

  it("3. checkout and subscription-created events arriving together make one plan, and cancelling it frees the ZIP code", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    const { applyFulfillmentEvent } = await import("@/lib/fulfillment");
    const common = { stripeCustomerId: "cus_race", stripeSubscriptionId: "sub_race", tier: "growth", customerEmail: "race@example.com" };

    const [checkout, createdEvent] = await Promise.all([
      applyFulfillmentEvent({ ...common, ...nextEvent(), eventType: "checkout.session.completed", paymentStatus: "paid", zip: "93618" }),
      applyFulfillmentEvent({ ...common, ...nextEvent(), eventType: "customer.subscription.created", subscriptionStatus: "active" }),
    ]);
    assert.equal(checkout.ok, true);
    assert.equal(createdEvent.ok, true);
    assert.equal((await rowsForStripeSubscription("sub_race")).length, 1);
    assert.equal(inDataFile().filter((record) => record.stripeSubscriptionId === "sub_race").length, 1);
    assert.deepEqual(await postgresLedger(), ["93618"]);

    const deleted = await applyFulfillmentEvent({ ...common, ...nextEvent(), eventType: "customer.subscription.deleted" });
    assert.equal(deleted.ok && deleted.applied, true);
    assert.deepEqual(await postgresLedger(), []);
    assert.deepEqual([...paidLedgerClaimedZips()], []);
  });

  it("3b. a cancellation also cancels an older duplicate plan for the same Stripe subscription", async () => {
    const first = subscription({ stripeSubscriptionId: "sub_dup", stripeCustomerId: "cus_dup" });
    const second = subscription({ stripeSubscriptionId: "sub_dup", stripeCustomerId: "cus_dup", claimedZips: ["93618"] });
    writeDb((db) => {
      db.revenueSubscriptions.push(first, second);
    });
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    const { applyFulfillmentEvent } = await import("@/lib/fulfillment");
    const deleted = await applyFulfillmentEvent({
      stripeCustomerId: "cus_dup",
      stripeSubscriptionId: "sub_dup",
      ...nextEvent(),
      eventType: "customer.subscription.deleted",
    });
    assert.equal(deleted.ok && deleted.applied, true);
    assert.deepEqual(await postgresLedger(), []);
    assert.deepEqual(
      inDataFile().filter((record) => record.stripeSubscriptionId === "sub_dup").map((record) => record.status),
      ["cancelled", "cancelled"],
    );
  });

  it("4. the first paid invoice keeps its ZIP code lock when a status update arrives at the same moment", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    const { applyFulfillmentEvent, lockZipOnPaidInvoice } = await import("@/lib/fulfillment");
    const common = { stripeCustomerId: "cus_trial", stripeSubscriptionId: "sub_trial", tier: "growth", customerEmail: "trial@example.com" };
    await applyFulfillmentEvent({ ...common, ...nextEvent(), eventType: "checkout.session.completed", paymentStatus: "no_payment_required", zip: "93618" });
    assert.deepEqual(await postgresLedger(), []);

    const [lock, update] = await Promise.all([
      lockZipOnPaidInvoice({ stripeSubscriptionId: "sub_trial", amountPaidCents: 9900, invoiceStatus: "paid" }),
      applyFulfillmentEvent({ ...common, ...nextEvent(), eventType: "customer.subscription.updated", subscriptionStatus: "active" }),
    ]);
    assert.equal(lock.zipClaimed, true);
    assert.equal(update.ok && update.applied, true);
    const stored = (await persistence.subscriptions.findByStripeSubscriptionId("sub_trial")) as RevenueSubscriptionRecord;
    assert.deepEqual(stored.claimedZips, ["93618"]);
    assert.equal(stored.pendingZip, undefined);
    assert.equal(stored.status, "active");
    assert.deepEqual(await postgresLedger(), ["93618"]);
    assert.deepEqual([...paidLedgerClaimedZips()], ["93618"]);
  });

  it("3c/4b. across processes, the database itself refuses a write decided from an outdated copy", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { StaleWriteError } = await import("./subscription-record");
    const { runSchemaMigrations } = await import("@/lib/persistence/schema");
    await runSchemaMigrations(database);
    const repository = new PostgresSubscriptionRepository(database);

    // Two events both found no plan for sub_x: only the first may create one.
    const created = await repository.save(subscription({ stripeSubscriptionId: "sub_x" }), { expected: null });
    await assert.rejects(repository.save(subscription({ stripeSubscriptionId: "sub_x" }), { expected: null }), StaleWriteError);
    assert.equal((await rowsForStripeSubscription("sub_x")).length, 1);

    // A trial's first paid invoice locks its ZIP code; a status update decided from the trial's older copy is refused.
    const trial = await repository.save({ ...created, status: "trialing", pendingZip: "93618" });
    const locked = await repository.saveWithZipClaim({ ...trial, status: "active", pendingZip: undefined }, "93618", { expected: trial });
    assert.equal(locked.zipClaimed, true);
    await assert.rejects(repository.save({ ...trial, status: "active" }, { expected: trial }), StaleWriteError);
    assert.deepEqual(await postgresLedger(), ["93618"]);
    // Decided again from the current copy, the update keeps the lock.
    const current = (await repository.findById(trial.id)) as RevenueSubscriptionRecord;
    await repository.save({ ...current, tier: "pro" }, { expected: current });
    assert.deepEqual((await repository.findById(trial.id))?.claimedZips, ["93618"]);
    assert.deepEqual(await postgresLedger(), ["93618"]);
  });

  it("5. a plan reactivated after another officer bought its old ZIP code is saved without it and can pick a new one", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    const { viewerPlanNeedingZip, claimReplacementZip } = await import("@/lib/zip-availability");
    const planA = await persistence.subscriptions.saveWithZipClaim(subscription({ ownerEmail: "a@example.com" }), "93618");
    await persistence.subscriptions.save({ ...planA.record, status: "cancelled" });
    const planB = await persistence.subscriptions.saveWithZipClaim(subscription({ ownerEmail: "b@example.com" }), "93618");
    assert.equal(planB.zipClaimed, true);

    // Plan A comes back (its record still lists 93618 from before).
    await persistence.subscriptions.save({ ...planA.record, status: "active" });
    const storedA = (await persistence.subscriptions.findById(planA.record.id)) as RevenueSubscriptionRecord;
    assert.deepEqual(storedA.claimedZips, []);
    assert.equal(storedA.zipLockConflict?.zip, "93618");
    assert.deepEqual(inDataFile().find((record) => record.id === planA.record.id)?.claimedZips, []);
    assert.equal(viewerPlanNeedingZip({ email: "a@example.com" })?.id, planA.record.id);
    assert.deepEqual(await claimReplacementZip({ email: "a@example.com" }, "93291"), { ok: true, zip: "93291" });
    assert.deepEqual(await postgresLedger(), ["93291", "93618"]);
    assert.equal((await persistence.checkParity())?.clean, true);
  });

  it("6. a failed copy to the data file is noticed and re-copied, instead of counted as done", async () => {
    const persistence = start("postgres", "postgres");
    assert.equal(await persistence.start(), true);
    const first = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
    assert.ok(onDisk().some((record) => record.id === first.record.id));

    // The disk refuses writes (the temporary file's name is taken by a folder).
    fs.mkdirSync(path.join(dataDir, `store.json.${process.pid}.tmp`));
    const second = await persistence.subscriptions.saveWithZipClaim(subscription(), "93291");
    assert.equal(second.zipClaimed, true);
    assert.equal(persistence.status().mirrorFailures, 1);
    assert.equal(persistence.status().dataFileBehind, true);
    assert.equal(onDisk().some((record) => record.id === second.record.id), false);

    // The disk recovers: the next write re-copies everything durably.
    fs.rmSync(path.join(dataDir, `store.json.${process.pid}.tmp`), { recursive: true, force: true });
    const third = await persistence.subscriptions.saveWithZipClaim(subscription(), "93277");
    assert.equal(persistence.status().dataFileBehind, false);
    const disk = onDisk().map((record) => record.id);
    for (const id of [first.record.id, second.record.id, third.record.id]) assert.ok(disk.includes(id), `${id} is on disk`);
  });

  it("6b. a hand-over to the data file that cannot be written durably does not count as done", async () => {
    const marker = memoryMarker();
    const live = start("postgres", "postgres", { authorityMarker: marker });
    assert.equal(await live.start(), true);
    await live.subscriptions.saveWithZipClaim(subscription(), "93618");
    await live.close();

    fs.mkdirSync(path.join(dataDir, `store.json.${process.pid}.tmp`));
    now += 5_000;
    const rolledBack = start("shadow", "shadow", { authorityMarker: marker });
    assert.equal(await rolledBack.start(), false);
    assert.equal(marker.value, "postgres");
    const { rows } = await database.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    assert.equal(rows[0].value, "postgres");
  });

  it("7. a replacement ZIP code is checked against the store in charge, not the data file's copy", async () => {
    const persistence = start("postgres", "postgres");
    await replacePersistenceForTests(persistence);
    open.length = 0;
    const { claimReplacementZip } = await import("@/lib/zip-availability");
    const plan = subscription({ ownerEmail: "gone@example.com" });
    await persistence.subscriptions.save(plan);
    await persistence.subscriptions.save({ ...plan, status: "cancelled" });
    // The data file's copy of the cancellation was lost: it still shows an active plan with no ZIP code.
    writeDb((db) => {
      const index = db.revenueSubscriptions.findIndex((record) => record.id === plan.id);
      db.revenueSubscriptions[index] = plan;
    });

    assert.deepEqual(await claimReplacementZip({ email: "gone@example.com" }, "93618"), { ok: false, reason: "no_conflict" });
    assert.equal((await postgresRow(plan.id)).status, "cancelled");
    assert.deepEqual(await postgresLedger(), []);
  });
});
