import type { SqlClient } from "./sql-client";

/**
 * PostgreSQL schema for Phase 1 of the move off the single data file: paid subscriptions and the
 * exclusive ZIP code ledger. Each entry runs once, in order, and is recorded in
 * `schema_migrations`. Never edit an entry that has shipped: add a new one.
 *
 * The older `migrations/001-003*.sql` files are an earlier draft of the whole schema. They have
 * never been applied anywhere and are not applied here: their `revenue_subscriptions` points at a
 * `loan_officers` table that stays in the data file until Phase 2.
 */
export interface SchemaMigration {
  version: string;
  sql: string;
}

export const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    version: "0001_subscriptions_and_zip_claims",
    sql: `
-- Lets one constraint say "the same ZIP code, a different holder" (see zip_claims below).
create extension if not exists btree_gist;

-- One row per plan a loan officer holds. A faithful copy of RevenueSubscriptionRecord:
-- every field of the record has a column, so a row converts back to the record with nothing lost.
create table revenue_subscriptions (
  id                           text primary key,
  created_at                   timestamptz not null,
  started_at                   timestamptz not null,
  tier                         text not null,
  status                       text not null check (status in ('trialing', 'active', 'cancelled')),
  source                       text not null check (source in ('seed', 'demo_request', 'admin_adjustment', 'stripe_webhook')),
  owner_lo_id                  text,
  owner_email                  text,
  company                      text,
  claimed_zips                 text[] not null default '{}',
  county_territories           text[],
  monthly_price_cents          integer,
  lifetime_months              integer,
  attributed_demo_request_ids  text[],
  stripe_customer_id           text,
  stripe_subscription_id       text,
  last_stripe_event_id         text,
  last_stripe_event_created_at bigint,
  pending_zip                  text,
  expires_at                   timestamptz,
  stripe_payment_intent_id     text,
  zip_lock_conflict_zip        text,
  zip_lock_conflict_at         timestamptz,
  addon                        text check (addon in ('extra_zip')),
  updated_at                   timestamptz not null default now(),
  constraint revenue_subscriptions_conflict_pair
    check ((zip_lock_conflict_zip is null) = (zip_lock_conflict_at is null))
);

-- The Stripe webhook looks a plan up by its Stripe subscription id on every event.
-- Not unique yet: the data file never enforced it. A later migration makes it unique once the
-- parity report shows no duplicates.
create index revenue_subscriptions_stripe_subscription on revenue_subscriptions (stripe_subscription_id);
create index revenue_subscriptions_stripe_customer on revenue_subscriptions (stripe_customer_id);
create index revenue_subscriptions_owner_email on revenue_subscriptions (lower(owner_email));
create index revenue_subscriptions_owner_lo on revenue_subscriptions (owner_lo_id);

-- The exclusive ZIP code ledger. One row per (ZIP code, plan) claim; a released claim keeps its
-- row as history. A claim is live while released_at is null and expires_at is in the future.
create table zip_claims (
  id              bigint generated always as identity primary key,
  zip             text not null check (zip ~ '^[0-9]{5}$'),
  subscription_id text not null references revenue_subscriptions (id) on delete cascade,
  -- Who holds the ZIP code: the Stripe customer, or the plan itself when it has no customer.
  holder_key      text not null,
  source          text not null check (source in ('seed', 'demo_request', 'admin_adjustment', 'stripe_webhook')),
  claimed_at      timestamptz not null default now(),
  -- Copy of the plan's prepaid end date (5-year plans). Null: held until the plan is cancelled.
  expires_at      timestamptz,
  released_at     timestamptz,
  release_reason  text check (release_reason in ('cancelled', 'expired', 'removed')),
  constraint zip_claims_release_pair check ((released_at is null) = (release_reason is null)),
  -- The business rule, enforced by the database: a ZIP code can have several live claims only
  -- when they all belong to the same holder (a customer replacing one plan with another).
  -- Two different holders can never both hold it, whatever the application does.
  constraint zip_claims_one_holder_per_zip
    exclude using gist (zip with =, holder_key with <>) where (released_at is null)
);

create unique index zip_claims_live_per_subscription on zip_claims (zip, subscription_id) where released_at is null;
create index zip_claims_live_zip on zip_claims (zip) where released_at is null;
create index zip_claims_subscription on zip_claims (subscription_id);

-- Small facts about the move itself. 'authority' records which store last decided subscription
-- writes ('json' or 'postgres'), so a switch in either direction first copies everything from
-- the store that was in charge. No row means 'json'.
create table persistence_state (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
`,
  },
];

/** Any 64-bit number: every app instance uses the same one so only one migrates at a time. */
const MIGRATION_LOCK_KEY = 7_781_204_611;

/**
 * Applies every migration that has not run yet and returns the versions it applied.
 * Safe to call on every start and from several instances at once.
 */
export async function runSchemaMigrations(
  client: SqlClient,
  migrations: SchemaMigration[] = SCHEMA_MIGRATIONS,
): Promise<string[]> {
  // Under the same lock as the migrations, so two servers starting together cannot collide
  // creating this table ("create table if not exists" is not safe against itself in parallel).
  await client.transaction(async (tx) => {
    await tx.query("select pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
    await tx.exec(
      "create table if not exists schema_migrations (version text primary key, applied_at timestamptz not null default now())",
    );
  });
  const applied: string[] = [];
  for (const migration of migrations) {
    const ran = await client.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock($1)", [MIGRATION_LOCK_KEY]);
      const existing = await tx.query("select 1 from schema_migrations where version = $1", [migration.version]);
      if (existing.rows.length > 0) return false;
      await tx.exec(migration.sql);
      await tx.query("insert into schema_migrations (version) values ($1)", [migration.version]);
      return true;
    });
    if (ran) applied.push(migration.version);
  }
  return applied;
}
