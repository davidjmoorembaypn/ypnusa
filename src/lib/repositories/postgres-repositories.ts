import type { SqlClient, SqlExecutor } from "@/lib/persistence/sql-client";
import { claimHolderKey, isLiveSubscription } from "@/lib/subscription-live";
import { isValidZip, normalizeZip } from "@/lib/zip-format";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { SUBSCRIPTION_COLUMNS, ledgerZips, recordToRow, rowToRecord } from "./subscription-record";
import type { SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";

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

  async save(record: RevenueSubscriptionRecord): Promise<void> {
    await this.saveReportingSkippedClaims(record);
  }

  /**
   * Saves the subscription and brings its ledger claims in line. Returns the ZIP codes the
   * record lists that the ledger refused because another holder already has them (possible only
   * for data copied from the data file, which never enforced the rule). The first holder keeps them.
   */
  async saveReportingSkippedClaims(record: RevenueSubscriptionRecord): Promise<string[]> {
    return this.client.transaction(async (tx) => {
      await lockZips(tx, ledgerZips(record));
      return this.store(tx, record, this.clock());
    });
  }

  async saveWithZipClaim(subscription: RevenueSubscriptionRecord, zip: string | null): Promise<ZipClaimOutcome> {
    return this.client.transaction(async (tx) => {
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

      await this.store(tx, record, now);
      return { record, zipClaimed, zipConflict, zipNewlyLocked };
    });
  }

  /** Upserts the row, then makes `zip_claims` match it. The caller already holds the ZIP code locks. */
  private async store(tx: SqlExecutor, record: RevenueSubscriptionRecord, now: number): Promise<string[]> {
    await tx.query(UPSERT_SQL, recordToRow(record));

    const live = isLiveSubscription(record, now);
    const desired = live ? ledgerZips(record) : [];
    const expired = Boolean(record.expiresAt) && Date.parse(record.expiresAt as string) <= now;
    const reason = record.status === "cancelled" ? "cancelled" : !live && expired ? "expired" : "removed";
    await tx.query(
      `update zip_claims set released_at = $2, release_reason = $3
        where subscription_id = $1 and released_at is null and not (zip = any($4::text[]))`,
      [record.id, new Date(now), reason, desired],
    );
    if (desired.length === 0) return [];

    await releaseExpired(tx, desired, now);
    const holder = claimHolderKey(record);
    const expiresAt = record.expiresAt ? new Date(Date.parse(record.expiresAt)) : null;
    const { rows } = await tx.query<{ id: string | number; zip: string; subscription_id: string; holder_key: string }>(
      "select id, zip, subscription_id, holder_key from zip_claims where zip = any($1::text[]) and released_at is null",
      [desired],
    );

    const skipped: string[] = [];
    for (const zip of desired) {
      const claims = rows.filter((row) => row.zip === zip);
      const mine = claims.find((row) => row.subscription_id === record.id);
      const heldByAnother = claims.some((row) => row.subscription_id !== record.id && row.holder_key !== holder);
      if (mine) {
        await tx.query("update zip_claims set source = $2, expires_at = $3, holder_key = $4 where id = $1", [
          mine.id,
          record.source,
          expiresAt,
          // A changed Stripe customer is recorded only when nobody else's claim would then clash.
          heldByAnother ? mine.holder_key : holder,
        ]);
      } else if (heldByAnother) {
        skipped.push(zip);
      } else {
        await tx.query(
          `insert into zip_claims (zip, subscription_id, holder_key, source, claimed_at, expires_at)
           values ($1, $2, $3, $4, $5, $6)`,
          [zip, record.id, holder, record.source, new Date(now), expiresAt],
        );
      }
    }
    return skipped;
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
