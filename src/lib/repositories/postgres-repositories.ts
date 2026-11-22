import type { SqlClient, SqlExecutor } from "@/lib/persistence/sql-client";
import { claimHolderKey, isLiveSubscription } from "@/lib/subscription-live";
import { isValidZip, normalizeZip } from "@/lib/zip-format";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { SUBSCRIPTION_COLUMNS, StaleWriteError, ledgerZips, recordToRow, rowToRecord, sameSubscription } from "./subscription-record";
import type { SaveOptions, SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";

/**
 * PostgreSQL behind the repository contracts.
 *
 * `revenue_subscriptions` holds each subscription as written. `zip_claims` is the exclusive ZIP
 * code ledger, kept in step with it inside the same transaction: saving a subscription releases
 * the claims it no longer has and adds the ones it gained. Two rules make a double sale
 * impossible:
 *   1. Every transaction that can touch a ZIP code's claims first takes that ZIP code's lock, so
 *      two payments for one ZIP code are decided one after the other, never at once.
 *   2. The table's own constraint refuses a second holder for a ZIP code, so even code that
 *      forgot rule 1 could not write one.
 */

/** First key of the two-part advisory lock: keeps ZIP code locks apart from any other lock. */
const ZIP_LOCK_NAMESPACE = 7781;
/** Same for the lock on one Stripe subscription's plans. Always taken before any ZIP code lock. */
const STRIPE_SUBSCRIPTION_LOCK_NAMESPACE = 7782;

const COLUMN_LIST = SUBSCRIPTION_COLUMNS.join(", ");
const UPSERT_SQL = `
insert into revenue_subscriptions (${COLUMN_LIST})
values (${SUBSCRIPTION_COLUMNS.map((_, index) => `$${index + 1}`).join(", ")})
on conflict (id) do update set
  ${SUBSCRIPTION_COLUMNS.filter((column) => column !== "id")
    .map((column) => `${column} = excluded.${column}`)
    .join(",\n  ")},
  updated_at = now()`;

/** Locks each ZIP code until the transaction ends. Sorted, so two transactions never wait on each other in a circle. */
async function lockZips(tx: SqlExecutor, zips: string[]): Promise<void> {
  for (const zip of [...new Set(zips)].sort()) {
    await tx.query("select pg_advisory_xact_lock($1::int, hashtext($2))", [ZIP_LOCK_NAMESPACE, zip]);
  }
}

/**
 * Refuses a write decided from a copy of the plan that is no longer current (SaveOptions.expected).
 * Takes the Stripe subscription's lock first, so two events for one plan are checked one after
 * the other even when the plan does not exist yet (there is no row to lock).
 */
async function checkExpected(tx: SqlExecutor, record: RevenueSubscriptionRecord, options: SaveOptions | undefined): Promise<void> {
  if (!options || options.expected === undefined) return;
  const stripeSubscriptionId = record.stripeSubscriptionId ?? options.expected?.stripeSubscriptionId;
  if (stripeSubscriptionId) {
    await tx.query("select pg_advisory_xact_lock($1::int, hashtext($2))", [STRIPE_SUBSCRIPTION_LOCK_NAMESPACE, stripeSubscriptionId]);
  }
  const expected = options.expected;
  if (expected === null) {
    const { rows } = await tx.query<{ id: string }>(
      "select id from revenue_subscriptions where id = $1 or ($2::text is not null and stripe_subscription_id = $2) limit 1",
      [record.id, stripeSubscriptionId ?? null],
    );
    if (rows.length > 0) throw new StaleWriteError(record.id, `a plan for this Stripe subscription already exists (${rows[0].id})`);
    return;
  }
  const { rows } = await tx.query(`select ${COLUMN_LIST} from revenue_subscriptions where id = $1 for update`, [expected.id]);
  if (rows.length === 0) throw new StaleWriteError(expected.id, "the plan no longer exists");
  if (!sameSubscription(rowToRecord(rows[0]), expected)) throw new StaleWriteError(expected.id, "another event changed the plan first");
}

/** A prepaid term that has ended no longer holds its ZIP codes: free them before deciding anything. */
async function releaseExpired(tx: SqlExecutor, zips: string[], now: number): Promise<void> {
  if (zips.length === 0) return;
  await tx.query(
    `update zip_claims set released_at = $2, release_reason = 'expired'
      where zip = any($1::text[]) and released_at is null and expires_at is not null and expires_at <= $2`,
    [zips, new Date(now)],
  );
}

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(
    private readonly client: SqlClient,
    private readonly clock: () => number = Date.now,
  ) {}

  async findById(id: string): Promise<RevenueSubscriptionRecord | null> {
    const { rows } = await this.client.query(`select ${COLUMN_LIST} from revenue_subscriptions where id = $1`, [id]);
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<RevenueSubscriptionRecord | null> {
    const { rows } = await this.client.query(
      `select ${COLUMN_LIST} from revenue_subscriptions where stripe_subscription_id = $1 order by created_at, id limit 1`,
      [stripeSubscriptionId],
    );
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async list(): Promise<RevenueSubscriptionRecord[]> {
    const { rows } = await this.client.query(`select ${COLUMN_LIST} from revenue_subscriptions order by created_at, id`);
    return rows.map(rowToRecord);
  }

  /**
   * Saves a plan PostgreSQL decides on. A ZIP code the plan lists but another holder took in the
   * meantime (a plan reactivated after its ZIP code was sold) is left off the stored plan and
   * recorded as zipLockConflict, so the dashboard asks the officer to pick an open one.
   */
  async save(record: RevenueSubscriptionRecord, options?: SaveOptions): Promise<RevenueSubscriptionRecord> {
    return this.client.transaction(async (tx) => {
      await checkExpected(tx, record, options);
      await lockZips(tx, ledgerZips(record));
      return (await this.store(tx, record, this.clock(), "decide")).stored;
    });
  }

  /**
   * Copies a plan another store decided (start-up copy, shadow mirror) exactly as written, and
   * returns the ZIP codes it lists that the ledger refused because another holder already has
   * them (possible only for data from the data file, which never enforced the rule). The first
   * holder keeps them; the copy is reported, never changed.
   */
  async saveReportingSkippedClaims(record: RevenueSubscriptionRecord): Promise<string[]> {
    return this.client.transaction(async (tx) => {
      await lockZips(tx, ledgerZips(record));
      return (await this.store(tx, record, this.clock(), "copy")).skipped;
    });
  }

  async saveWithZipClaim(subscription: RevenueSubscriptionRecord, zip: string | null, options?: SaveOptions): Promise<ZipClaimOutcome> {
    return this.client.transaction(async (tx) => {
      await checkExpected(tx, subscription, options);
      const now = this.clock();
      const ledgerZip = zip === null ? null : normalizeZip(zip);
      const decidable = ledgerZip !== null && isValidZip(ledgerZip);
      await lockZips(tx, decidable ? [...ledgerZips(subscription), ledgerZip] : ledgerZips(subscription));

      let zipConflict = false;
      let alreadyHeld = false;
      if (decidable) {
        await releaseExpired(tx, [ledgerZip], now);
        const holder = claimHolderKey(subscription);
        const live = await tx.query<{ subscription_id: string; holder_key: string }>(
          "select subscription_id, holder_key from zip_claims where zip = $1 and released_at is null",
          [ledgerZip],
        );
        alreadyHeld = live.rows.length > 0;
        // Another holder has it. The same holder's other subscription is a transfer, not a conflict.
        zipConflict = live.rows.some((row) => row.subscription_id !== subscription.id && row.holder_key !== holder);
      }

      const zipClaimed = zip !== null && !zipConflict && !subscription.claimedZips.includes(zip);
      const zipNewlyLocked = zipClaimed && !alreadyHeld;
      // On a conflict the ZIP code is also stripped from this record: it may still list it from
      // an earlier state, which would leave two live subscriptions naming the same ZIP code.
      const record: RevenueSubscriptionRecord = zipClaimed
        ? { ...subscription, claimedZips: [...subscription.claimedZips, zip] }
        : zipConflict
          ? { ...subscription, claimedZips: subscription.claimedZips.filter((claimed) => claimed !== zip) }
          : subscription;

      const { stored } = await this.store(tx, record, now, "decide");
      return { record: stored, zipClaimed, zipConflict, zipNewlyLocked };
    });
  }

  /**
   * Upserts the row, then makes `zip_claims` match it. The caller already holds the ZIP code locks.
   * "decide": a ZIP code another holder has is taken off the stored plan and flagged as a conflict.
   * "copy": the plan is stored exactly as given and the refused ZIP codes are only reported.
   */
  private async store(
    tx: SqlExecutor,
    input: RevenueSubscriptionRecord,
    now: number,
    mode: "decide" | "copy",
  ): Promise<{ stored: RevenueSubscriptionRecord; skipped: string[] }> {
    const live = isLiveSubscription(input, now);
    const wanted = live ? ledgerZips(input) : [];
    const holder = claimHolderKey(input);

    // Who holds each ZIP code this plan wants, before anything changes.
    let claims: Array<{ id: string | number; zip: string; subscription_id: string; holder_key: string }> = [];
    if (wanted.length > 0) {
      await releaseExpired(tx, wanted, now);
      claims = (
        await tx.query<{ id: string | number; zip: string; subscription_id: string; holder_key: string }>(
          "select id, zip, subscription_id, holder_key from zip_claims where zip = any($1::text[]) and released_at is null",
          [wanted],
        )
      ).rows;
    }
    const takenByAnother = (zip: string) => claims.some((row) => row.zip === zip && row.subscription_id !== input.id && row.holder_key !== holder);
    const skipped = wanted.filter((zip) => takenByAnother(zip) && !claims.some((row) => row.zip === zip && row.subscription_id === input.id));

    let record = input;
    if (mode === "decide" && skipped.length > 0) {
      record = {
        ...input,
        claimedZips: input.claimedZips.filter((raw) => !skipped.includes(normalizeZip(raw))),
        zipLockConflict: input.zipLockConflict ?? { zip: skipped[0], at: new Date(now).toISOString() },
      };
    }
    await tx.query(UPSERT_SQL, recordToRow(record));

    const desired = wanted.filter((zip) => !(mode === "decide" && skipped.includes(zip)));
    const expired = Boolean(record.expiresAt) && Date.parse(record.expiresAt as string) <= now;
    const reason = record.status === "cancelled" ? "cancelled" : !live && expired ? "expired" : "removed";
    await tx.query(
      `update zip_claims set released_at = $2, release_reason = $3
        where subscription_id = $1 and released_at is null and not (zip = any($4::text[]))`,
      [record.id, new Date(now), reason, desired],
    );
    if (desired.length === 0) return { stored: record, skipped };

    const expiresAt = record.expiresAt ? new Date(Date.parse(record.expiresAt)) : null;
    for (const zip of desired) {
      const mine = claims.find((row) => row.zip === zip && row.subscription_id === record.id);
      const heldByAnother = takenByAnother(zip);
      if (mine) {
        await tx.query("update zip_claims set source = $2, expires_at = $3, holder_key = $4 where id = $1", [
          mine.id,
          record.source,
          expiresAt,
          // A changed Stripe customer is recorded only when nobody else's claim would then clash.
          heldByAnother ? mine.holder_key : holder,
        ]);
      } else if (!heldByAnother) {
        await tx.query(
          `insert into zip_claims (zip, subscription_id, holder_key, source, claimed_at, expires_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [zip, record.id, holder, record.source, new Date(now), expiresAt],
        );
      }
    }
    return { stored: record, skipped };
  }
}

export class PostgresTerritoryLedgerRepository implements TerritoryLedgerRepository {
  constructor(private readonly client: SqlClient) {}

  async paidClaimedZips(now: number = Date.now()): Promise<Set<string>> {
    const { rows } = await this.client.query<{ zip: string }>(
      `select distinct zip from zip_claims
        where released_at is null
          and (expires_at is null or expires_at > $1)
          and source in ('stripe_webhook', 'admin_adjustment')`,
      [new Date(now)],
    );
    return new Set(rows.map((row) => row.zip));
  }

  async isPaidClaimed(zip: string, now: number = Date.now()): Promise<boolean> {
    const { rows } = await this.client.query(
      `select 1 from zip_claims
        where zip = $1 and released_at is null
          and (expires_at is null or expires_at > $2)
          and source in ('stripe_webhook', 'admin_adjustment')
        limit 1`,
      [zip, new Date(now)],
    );
    return rows.length > 0;
  }
}
