import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createPgliteClient } from "@/lib/repositories/test-support";
import { SCHEMA_MIGRATIONS, runSchemaMigrations } from "./schema";
import type { SqlClient } from "./sql-client";

describe("PostgreSQL schema for subscriptions and the ZIP code ledger", () => {
  let client: SqlClient;
  before(async () => {
    client = await createPgliteClient();
  });
  after(() => client.close());

  const insertSubscription = (id: string) =>
    client.query(
      `insert into revenue_subscriptions (id, created_at, started_at, tier, status, source)
       values ($1, now(), now(), 'growth', 'active', 'stripe_webhook')`,
      [id],
    );
  const claim = (zip: string, subscriptionId: string, holder: string) =>
    client.query("insert into zip_claims (zip, subscription_id, holder_key, source) values ($1, $2, $3, 'stripe_webhook')", [
      zip,
      subscriptionId,
      holder,
    ]);

  it("applies each migration once, however often it is run", async () => {
    assert.deepEqual(await runSchemaMigrations(client), SCHEMA_MIGRATIONS.map((migration) => migration.version));
    assert.deepEqual(await runSchemaMigrations(client), []);
    assert.deepEqual(await runSchemaMigrations(client), []);
    const { rows } = await client.query<{ version: string }>("select version from schema_migrations order by version");
    assert.deepEqual(
      rows.map((row) => row.version),
      SCHEMA_MIGRATIONS.map((migration) => migration.version),
    );
  });

  it("rolls a failed migration back completely and does not record it", async () => {
    const broken = [...SCHEMA_MIGRATIONS, { version: "9999_broken", sql: "create table half_done (id int); select no_such_function();" }];
    await assert.rejects(runSchemaMigrations(client, broken));
    const { rows } = await client.query("select 1 from schema_migrations where version = '9999_broken'");
    assert.equal(rows.length, 0);
    await assert.rejects(client.query("select 1 from half_done"));
  });

  it("the database itself refuses a second holder for a ZIP code, even with no application code", async () => {
    await insertSubscription("sub_a");
    await insertSubscription("sub_b");
    await insertSubscription("sub_a2");
    await claim("93618", "sub_a", "cus_a");
    // The same holder's other plan may share it (a replacement before the old plan is cancelled).
    await claim("93618", "sub_a2", "cus_a");
    await assert.rejects(claim("93618", "sub_b", "cus_b"), (error: { code?: string; constraint?: string }) => {
      assert.equal(error.code, "23P01");
      assert.equal(error.constraint, "zip_claims_one_holder_per_zip");
      return true;
    });
    // The same plan cannot hold the same ZIP code twice.
    await assert.rejects(claim("93618", "sub_a", "cus_a"), (error: { code?: string }) => error.code === "23505");

    // Once every claim on it is released, another holder may take it; the history stays.
    await client.query("update zip_claims set released_at = now(), release_reason = 'cancelled' where zip = '93618'");
    await claim("93618", "sub_b", "cus_b");
    const { rows } = await client.query<{ live: number | string; total: number | string }>(
      "select count(*) filter (where released_at is null) as live, count(*) as total from zip_claims where zip = '93618'",
    );
    assert.equal(Number(rows[0].live), 1);
    assert.equal(Number(rows[0].total), 3);
  });

  it("rejects values the app never writes", async () => {
    await assert.rejects(claim("9361", "sub_a", "cus_a"), (error: { code?: string }) => error.code === "23514");
    await assert.rejects(claim("93291", "sub_missing", "cus_x"), (error: { code?: string }) => error.code === "23503");
    await assert.rejects(
      client.query(
        `insert into revenue_subscriptions (id, created_at, started_at, tier, status, source)
         values ('sub_bad', now(), now(), 'growth', 'paused', 'stripe_webhook')`,
      ),
      (error: { code?: string }) => error.code === "23514",
    );
    // A released claim must say why, and a live one must not.
    await assert.rejects(
      client.query("update zip_claims set released_at = now() where subscription_id = 'sub_b'"),
      (error: { code?: string }) => error.code === "23514",
    );
  });

  it("deleting a subscription removes its claims", async () => {
    await client.query("delete from revenue_subscriptions where id = 'sub_b'");
    const { rows } = await client.query("select 1 from zip_claims where subscription_id = 'sub_b'");
    assert.equal(rows.length, 0);
  });
});
