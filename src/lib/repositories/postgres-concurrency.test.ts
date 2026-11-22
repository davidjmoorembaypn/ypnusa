import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { SqlClient } from "@/lib/persistence/sql-client";

/**
 * The real race: many payments for one ZIP code arriving at the same moment on separate
 * database connections. Needs a PostgreSQL server, so it runs only when TEST_DATABASE_URL is
 * set (CI starts one). The in-process engine used by the other tests has a single connection
 * and cannot show two transactions overlapping.
 *
 * Every run works in its own schema and drops it afterwards.
 */
const url = process.env.TEST_DATABASE_URL?.trim();

describe("one ZIP code, many payments at once (PostgreSQL server)", { skip: url ? false : "TEST_DATABASE_URL is not set" }, () => {
  const schema = `ypn_race_${process.pid}_${Date.now()}`;
  let client: SqlClient;
  let admin: SqlClient;

  before(async () => {
    const { createPgClient, databaseSettings } = await import("@/lib/persistence/sql-client");
    const { runSchemaMigrations } = await import("@/lib/persistence/schema");
    const base = databaseSettings({ DATABASE_URL: url } as unknown as NodeJS.ProcessEnv);
    assert.ok(base);
    admin = await createPgClient({ ...base, poolSize: 1 });
    await admin.exec(`create schema ${schema}`);
    const scoped = new URL(base.connectionString);
    scoped.searchParams.set("options", `-c search_path=${schema},public`);
    client = await createPgClient({ ...base, connectionString: scoped.toString(), poolSize: 12 });
    await runSchemaMigrations(client);
  });
  after(async () => {
    await client?.close();
    await admin?.exec(`drop schema if exists ${schema} cascade`);
    await admin?.close();
  });

  it("exactly one of 40 simultaneous payments gets the ZIP code; the other 39 are saved without it", async () => {
    const { PostgresSubscriptionRepository, PostgresTerritoryLedgerRepository } = await import("./postgres-repositories");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    const ledger = new PostgresTerritoryLedgerRepository(client);

    const outcomes = await Promise.all(
      Array.from({ length: 40 }, () => subscriptions.saveWithZipClaim(subscription(), "93618")),
    );
    assert.equal(outcomes.filter((outcome) => outcome.zipClaimed).length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.zipNewlyLocked).length, 1);
    assert.equal(outcomes.filter((outcome) => outcome.zipConflict).length, 39);

    const stored = await subscriptions.list();
    assert.equal(stored.length, 40);
    assert.equal(stored.filter((record) => record.claimedZips.includes("93618")).length, 1);
    const { rows } = await client.query<{ live: string }>("select count(*) as live from zip_claims where zip = '93618' and released_at is null");
    assert.equal(Number(rows[0].live), 1);
    assert.deepEqual([...(await ledger.paidClaimedZips())], ["93618"]);
  });

  it("two plans that each want the other's ZIP code at the same moment do not deadlock", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    // Plan A lists ZIP code X and claims Y while plan B lists Y and claims X. Taking the two
    // locks in a different order in each transaction would deadlock; they are always sorted.
    for (let round = 0; round < 20; round += 1) {
      const x = String(94000 + round);
      const y = String(95000 + round);
      const [a, b] = await Promise.all([
        subscriptions.saveWithZipClaim(subscription({ claimedZips: [x] }), y),
        subscriptions.saveWithZipClaim(subscription({ claimedZips: [y] }), x),
      ]);
      assert.equal(a.zipClaimed !== b.zipClaimed, true, "exactly one of the two gets its second ZIP code");
      const { rows } = await client.query<{ zip: string; holders: string }>(
        `select zip, count(distinct holder_key) as holders from zip_claims
          where zip = any($1::text[]) and released_at is null group by zip order by zip`,
        [[x, y]],
      );
      assert.deepEqual(rows.map((row) => [row.zip, Number(row.holders)]), [[x, 1], [y, 1]]);
    }
  });

  it("a claim racing a cancellation never leaves the ZIP code with two holders or with none it should have", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    for (let round = 0; round < 15; round += 1) {
      const zip = String(96000 + round);
      const holder = await subscriptions.saveWithZipClaim(subscription(), zip);
      const [, challenger] = await Promise.all([
        subscriptions.save({ ...holder.record, status: "cancelled" }),
        subscriptions.saveWithZipClaim(subscription(), zip),
      ]);
      const { rows } = await client.query<{ subscription_id: string }>(
        "select subscription_id from zip_claims where zip = $1 and released_at is null",
        [zip],
      );
      // Whichever ran first, the result is consistent: the challenger holds it, or nobody does.
      assert.deepEqual(rows.map((row) => row.subscription_id), challenger.zipClaimed ? [challenger.record.id] : []);
      assert.equal(challenger.zipClaimed, !challenger.zipConflict);
    }
  });

  it("events for one new Stripe subscription arriving at once on separate connections make exactly one plan", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { retryStaleWrites } = await import("./plan-lock");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    for (let round = 0; round < 10; round += 1) {
      const stripeSubscriptionId = `sub_race_${round}`;
      // Each event reads, finds no plan, and creates one, naming what it read (nothing).
      const event = (tier: "pro" | "growth") =>
        retryStaleWrites(async () => {
          const found = await subscriptions.findByStripeSubscriptionId(stripeSubscriptionId);
          return subscriptions.save(found ? { ...found, tier } : subscription({ stripeSubscriptionId, tier }), { expected: found });
        }, 10);
      await Promise.all([event("pro"), event("growth"), event("pro"), event("growth")]);
      const { rows } = await client.query("select id from revenue_subscriptions where stripe_subscription_id = $1", [stripeSubscriptionId]);
      assert.equal(rows.length, 1);
    }
  });

  it("a first paid invoice and a status update at once on separate connections keep the ZIP code locked", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { retryStaleWrites } = await import("./plan-lock");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    for (let round = 0; round < 10; round += 1) {
      const zip = String(98000 + round);
      const trial = await subscriptions.save(subscription({ status: "trialing", pendingZip: zip }));
      const key = trial.stripeSubscriptionId as string;
      const invoice = retryStaleWrites(async () => {
        const found = (await subscriptions.findByStripeSubscriptionId(key)) as typeof trial;
        if (!found.pendingZip) return null;
        return subscriptions.saveWithZipClaim({ ...found, status: "active", pendingZip: undefined }, found.pendingZip, { expected: found });
      }, 10);
      const update = retryStaleWrites(async () => {
        const found = (await subscriptions.findByStripeSubscriptionId(key)) as typeof trial;
        return subscriptions.save({ ...found, status: "active", tier: "pro" }, { expected: found });
      }, 10);
      await Promise.all([invoice, update]);
      const stored = await subscriptions.findById(trial.id);
      assert.deepEqual(stored?.claimedZips, [zip]);
      assert.equal(stored?.pendingZip, undefined);
      const { rows } = await client.query("select 1 from zip_claims where zip = $1 and released_at is null", [zip]);
      assert.equal(rows.length, 1);
    }
  });

  it("the driver's own types round-trip (bigint, timestamps, arrays)", async () => {
    const { PostgresSubscriptionRepository } = await import("./postgres-repositories");
    const { differingFields } = await import("./subscription-record");
    const { subscription } = await import("./test-support");
    const subscriptions = new PostgresSubscriptionRepository(client);
    const full = subscription({
      claimedZips: ["97001"],
      countyTerritories: ["Tulare", "Fresno"],
      attributedDemoRequestIds: ["demo_1"],
      lastStripeEventCreatedAt: 1_900_000_123,
      expiresAt: "2031-11-21T08:09:10.123Z",
      zipLockConflict: { zip: "97002", at: "2026-11-21T10:00:00.456Z" },
      monthlyPriceCents: 29900,
    });
    await subscriptions.save(full);
    const stored = await subscriptions.findById(full.id);
    assert.ok(stored);
    assert.deepEqual(differingFields(full, stored), []);
    assert.deepEqual(stored, full);
  });
});
