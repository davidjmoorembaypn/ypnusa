import { configureLedgerReadModel, ledgerReadModelStatus, refreshLedgerReadModel } from "@/lib/persistence/ledger-read-model";
import type { PersistenceModes } from "@/lib/persistence/mode";
import { runSchemaMigrations } from "@/lib/persistence/schema";
import { DatabaseUnavailableError, type SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { PostgresSubscriptionRepository, PostgresTerritoryLedgerRepository } from "./postgres-repositories";
import { RecordNotStorableError, differingFields, sameSubscription } from "./subscription-record";
import type { SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";

/**
 * Runs the move from the data file to PostgreSQL behind the repository contracts.
 *
 * Callers use `subscriptions` and `ledger` and never know which store answered. This class
 * applies the configured mode (@/lib/persistence/mode):
 *
 *   json      Straight to the data file.
 *   shadow    The data file decides. Each write is then copied to PostgreSQL; reads are compared.
 *             A failed copy never fails the request: it is counted and repaired by a full
 *             re-copy before the next write.
 *   postgres  PostgreSQL decides. Each write is then copied back to the data file.
 *             If PostgreSQL cannot be reached a payment event is refused (Stripe redelivers it),
 *             because letting the data file decide alone would split the two stores. ZIP code
 *             availability and every dashboard keep answering from the data file's copy.
 *
 * Switching mode in either direction is lossless: at start, the store that was in charge last
 * is copied in full to the other before anything else happens.
 */

export type Authority = "json" | "postgres";

export interface ParityReport {
  checkedAt: string;
  /** True when both stores hold the same subscriptions and the same paid ZIP code ledger. */
  clean: boolean;
  subscriptions: {
    dataFile: number;
    postgres: number;
    onlyInDataFile: string[];
    onlyInPostgres: string[];
    different: Array<{ id: string; fields: string[] }>;
  };
  ledger: { dataFile: number; postgres: number; onlyInDataFile: string[]; onlyInPostgres: string[] };
}

export interface SyncReport {
  from: Authority;
  copied: number;
  unchanged: number;
  /** Records the target store could not hold as written (for example an unreadable date). */
  failed: string[];
  /** ZIP codes a record lists that the ledger left with an earlier, different holder. */
  refusedClaims: Array<{ subscriptionId: string; zip: string }>;
}

export interface PersistenceStatus {
  /** A database connection is configured (DATABASE_URL). */
  configured: boolean;
  ledger: PersistenceModes["ledger"];
  subscriptions: PersistenceModes["subscriptions"];
  /** Connected, tables in place, and the two stores brought in line since this process started. */
  ready: boolean;
  parity: { clean: boolean; mismatches: number; checkedAt: string } | null;
  /** Copies to the other store that failed or were skipped since start. Zero before any switch. */
  mirrorFailures: number;
  /** Payment-flow reads and writes refused because PostgreSQL was in charge and unreachable. */
  writeFailures: number;
  /** Subscription reads in shadow mode whose PostgreSQL copy differed. */
  readMismatches: number;
  ledgerMismatches: number;
  /** Times the ZIP code ledger answered from the data file because PostgreSQL had no fresh answer. */
  ledgerFallbacks: number;
}

export interface PersistenceOptions {
  modes: PersistenceModes;
  json: { subscriptions: SubscriptionRepository; ledger: TerritoryLedgerRepository };
  /** Opens the PostgreSQL connection. Null when no database is configured. */
  connect: (() => Promise<SqlClient>) | null;
  clock?: () => number;
  /** Wait this long after a failed start before trying the database again. */
  retryAfterMs?: number;
  /** How long to wait before re-checking a difference, so a write in flight is not reported. */
  recheckAfterMs?: number;
  log?: (message: string) => void;
}

const LIST_LIMIT = 20;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class Persistence {
  readonly subscriptions: SubscriptionRepository;
  readonly ledger: TerritoryLedgerRepository;

  private readonly modes: PersistenceModes;
  private readonly json: PersistenceOptions["json"];
  private readonly connect: PersistenceOptions["connect"];
  private readonly clock: () => number;
  private readonly retryAfterMs: number;
  private readonly recheckAfterMs: number;
  private readonly log: (message: string) => void;

  private pg: { client: SqlClient; subscriptions: PostgresSubscriptionRepository; ledger: PostgresTerritoryLedgerRepository } | null = null;
  private ready = false;
  private starting: Promise<boolean> | null = null;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  /** The store that is not in charge missed at least one write and needs a full re-copy. */
  private needsResync = false;
  private parity: ParityReport | null = null;
  private readonly background = new Set<Promise<unknown>>();
  private readonly counters = { mirrorFailures: 0, writeFailures: 0, readMismatches: 0, ledgerMismatches: 0 };

  constructor(options: PersistenceOptions) {
    this.modes = options.modes;
    this.json = options.json;
    this.connect = options.connect;
    this.clock = options.clock ?? Date.now;
    this.retryAfterMs = options.retryAfterMs ?? 10_000;
    this.recheckAfterMs = options.recheckAfterMs ?? 250;
    this.log = options.log ?? ((message) => console.log(`[persistence] ${message}`));

    this.subscriptions = {
      findById: (id) => this.read((repository) => repository.findById(id), (record) => (record ? [record] : [])),
      findByStripeSubscriptionId: (id) =>
        this.read((repository) => repository.findByStripeSubscriptionId(id), (record) => (record ? [record] : [])),
      list: () => this.read((repository) => repository.list(), (records) => records),
      save: async (record) => {
        await this.write(record, async (repository) => {
          await repository.save(record);
          return record;
        });
      },
      saveWithZipClaim: async (record, zip) => {
        let outcome!: ZipClaimOutcome;
        await this.write(record, async (repository) => {
          outcome = await repository.saveWithZipClaim(record, zip);
          return outcome.record;
        });
        return outcome;
      },
    };

    this.ledger = {
      paidClaimedZips: (now = this.clock()) => this.ledgerRead((repository) => repository.paidClaimedZips(now)),
      isPaidClaimed: (zip, now = this.clock()) => this.ledgerRead((repository) => repository.isPaidClaimed(zip, now)),
    };

  }

  /**
   * Makes this instance the one that answers the app's synchronous ZIP code checks
   * (paidLedgerClaimedZips). The process-wide instance is activated when it is built.
   */
  activate(): this {
    configureLedgerReadModel(
      this.connect && this.modes.ledger !== "json"
        ? {
            mode: this.modes.ledger,
            now: this.clock,
            load: async () => {
              if (!(await this.ensureReady()) || !this.pg) throw new DatabaseUnavailableError();
              return this.pg.ledger.paidClaimedZips(this.clock());
            },
            compare: (dataFileAnswer) => this.inBackground(this.compareLedger(dataFileAnswer)),
          }
        : null,
    );
    return this;
  }

  /** Connects, prepares the tables and brings the two stores in line. Never throws. */
  start(): Promise<boolean> {
    return this.ensureReady();
  }

  /** Waits for background comparisons. For tests and for a clean shutdown. */
  async settle(): Promise<void> {
    while (this.background.size > 0) await Promise.allSettled([...this.background]);
  }

  async close(): Promise<void> {
    await this.settle();
    await this.pg?.client.close().catch(() => undefined);
    this.pg = null;
    this.ready = false;
  }

  status(): PersistenceStatus {
    const readModel = ledgerReadModelStatus();
    const parity = this.parity;
    return {
      configured: this.connect !== null,
      ledger: this.modes.ledger,
      subscriptions: this.modes.subscriptions,
      ready: this.ready,
      parity: parity
        ? {
            clean: parity.clean,
            mismatches:
              parity.subscriptions.onlyInDataFile.length +
              parity.subscriptions.onlyInPostgres.length +
              parity.subscriptions.different.length +
              parity.ledger.onlyInDataFile.length +
              parity.ledger.onlyInPostgres.length,
            checkedAt: parity.checkedAt,
          }
        : null,
      mirrorFailures: this.counters.mirrorFailures,
      writeFailures: this.counters.writeFailures,
      readMismatches: this.counters.readMismatches,
      ledgerMismatches: this.counters.ledgerMismatches,
      ledgerFallbacks: readModel.fallbacks,
    };
  }

  /** Compares the two stores in full. Null when PostgreSQL is not ready. */
  async checkParity(): Promise<ParityReport | null> {
    if (!(await this.ensureReady()) || !this.pg) return null;
    const now = this.clock();
    const [dataFile, postgres, dataFileLedger, postgresLedger] = await Promise.all([
      this.json.subscriptions.list(),
      this.pg.subscriptions.list(),
      this.json.ledger.paidClaimedZips(now),
      this.pg.ledger.paidClaimedZips(now),
    ]);
    const inPostgres = new Map(postgres.map((record) => [record.id, record]));
    const inDataFile = new Map(dataFile.map((record) => [record.id, record]));
    const different: ParityReport["subscriptions"]["different"] = [];
    for (const record of dataFile) {
      const other = inPostgres.get(record.id);
      if (other && !sameSubscription(record, other)) different.push({ id: record.id, fields: differingFields(record, other) });
    }
    const report: ParityReport = {
      checkedAt: new Date(now).toISOString(),
      clean: false,
      subscriptions: {
        dataFile: dataFile.length,
        postgres: postgres.length,
        onlyInDataFile: dataFile.filter((record) => !inPostgres.has(record.id)).map((record) => record.id),
        onlyInPostgres: postgres.filter((record) => !inDataFile.has(record.id)).map((record) => record.id),
        different,
      },
      ledger: {
        dataFile: dataFileLedger.size,
        postgres: postgresLedger.size,
        onlyInDataFile: [...dataFileLedger].filter((zip) => !postgresLedger.has(zip)).sort(),
        onlyInPostgres: [...postgresLedger].filter((zip) => !dataFileLedger.has(zip)).sort(),
      },
    };
    report.clean =
      report.subscriptions.onlyInDataFile.length === 0 &&
      report.subscriptions.onlyInPostgres.length === 0 &&
      report.subscriptions.different.length === 0 &&
      report.ledger.onlyInDataFile.length === 0 &&
      report.ledger.onlyInPostgres.length === 0;
    this.parity = report;
    if (!report.clean) {
      this.log(
        `parity check found differences: ${JSON.stringify({
          subscriptions: {
            onlyInDataFile: report.subscriptions.onlyInDataFile.slice(0, LIST_LIMIT),
            onlyInPostgres: report.subscriptions.onlyInPostgres.slice(0, LIST_LIMIT),
            different: report.subscriptions.different.slice(0, LIST_LIMIT),
          },
          ledger: {
            onlyInDataFile: report.ledger.onlyInDataFile.slice(0, LIST_LIMIT),
            onlyInPostgres: report.ledger.onlyInPostgres.slice(0, LIST_LIMIT),
          },
        })}`,
      );
    }
    return report;
  }

  /**
   * Copies every subscription that is missing or different from the store in charge to the other
   * one. Records only the other store holds are left alone and show up in the parity report.
   * `repair` re-saves every record even when it looks unchanged, which rebuilds the ZIP code ledger.
   */
  async synchronise(from: Authority, repair = false): Promise<SyncReport> {
    if (!this.pg) throw new DatabaseUnavailableError();
    const source = from === "json" ? this.json.subscriptions : this.pg.subscriptions;
    const target = from === "json" ? this.pg.subscriptions : this.json.subscriptions;
    const [listed, existing] = await Promise.all([source.list(), target.list()]);
    // Cancelled subscriptions first: copying one releases its ZIP codes, so a newer holder's
    // claim on the same ZIP code is not refused by a claim that is about to disappear.
    const records = [...listed].sort((a, b) => Number(a.status !== "cancelled") - Number(b.status !== "cancelled"));
    const current = new Map(existing.map((record) => [record.id, record]));
    const report: SyncReport = { from, copied: 0, unchanged: 0, failed: [], refusedClaims: [] };
    for (const record of records) {
      const copy = current.get(record.id);
      if (copy && !repair && sameSubscription(record, copy)) {
        report.unchanged += 1;
        continue;
      }
      try {
        if (from === "json") {
          const refused = await this.pg.subscriptions.saveReportingSkippedClaims(record);
          for (const zip of refused) report.refusedClaims.push({ subscriptionId: record.id, zip });
        } else {
          await target.save(record);
        }
        report.copied += 1;
      } catch (error) {
        if (!(error instanceof RecordNotStorableError)) throw error;
        report.failed.push(record.id);
      }
    }
    if (report.failed.length > 0 || report.refusedClaims.length > 0) {
      this.log(
        `copy from ${from} left work for a person: ${JSON.stringify({
          failed: report.failed.slice(0, LIST_LIMIT),
          refusedClaims: report.refusedClaims.slice(0, LIST_LIMIT),
        })}`,
      );
    }
    return report;
  }

  // ---- start-up -------------------------------------------------------------------------

  private get desiredAuthority(): Authority {
    return this.modes.subscriptions === "postgres" ? "postgres" : "json";
  }

  private ensureReady(): Promise<boolean> {
    if (!this.connect) return Promise.resolve(false);
    if (this.ready) return Promise.resolve(true);
    if (this.starting) return this.starting;
    const now = this.clock();
    if (now - this.lastAttemptAt < this.retryAfterMs) return Promise.resolve(false);
    this.lastAttemptAt = now;
    this.starting = this.boot().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async boot(): Promise<boolean> {
    try {
      if (!this.pg) {
        const client = await (this.connect as () => Promise<SqlClient>)();
        this.pg = {
          client,
          subscriptions: new PostgresSubscriptionRepository(client, this.clock),
          ledger: new PostgresTerritoryLedgerRepository(client),
        };
      }
      const applied = await runSchemaMigrations(this.pg.client);
      if (applied.length > 0) this.log(`applied database migrations: ${applied.join(", ")}`);

      // Hand-over: if the other store was in charge last time, it holds the truth. Copy it over
      // in full before this process lets the newly chosen store decide anything.
      const stored = await this.storedAuthority();
      const desired = this.desiredAuthority;
      if (stored !== desired) {
        const handover = await this.synchronise(stored);
        this.log(`hand-over from ${stored} to ${desired}: ${handover.copied} copied, ${handover.unchanged} already in step`);
        await this.pg.client.query(
          `insert into persistence_state (key, value) values ('authority', $1)
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [desired],
        );
      }
      // Keep the other store in step. In json mode PostgreSQL is not kept up to date at all.
      if (this.modes.subscriptions !== "json") {
        const sync = await this.synchronise(desired);
        this.ready = true;
        let parity = await this.checkParity();
        if (parity && !parity.clean && desired === "json") {
          // Same records but a different ledger means the claims table drifted: rebuild it once.
          await this.synchronise("json", true);
          parity = await this.checkParity();
        }
        this.log(
          `ready (ledger=${this.modes.ledger}, subscriptions=${this.modes.subscriptions}): ${sync.copied} copied, ${sync.unchanged} already in step, parity ${parity?.clean ? "clean" : "NOT clean"}`,
        );
      } else {
        this.ready = true;
        this.log("database reachable and tables in place; the data file is still the only store in use");
      }
      this.needsResync = false;
      if (this.modes.ledger === "postgres") await refreshLedgerReadModel();
      return true;
    } catch (error) {
      this.ready = false;
      this.log(`database not ready: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async storedAuthority(): Promise<Authority> {
    if (!this.pg) throw new DatabaseUnavailableError();
    const { rows } = await this.pg.client.query<{ value: string }>("select value from persistence_state where key = 'authority'");
    return rows[0]?.value === "postgres" ? "postgres" : "json";
  }

  // ---- reads ----------------------------------------------------------------------------

  private async read<T>(
    run: (repository: SubscriptionRepository) => Promise<T>,
    recordsOf: (value: T) => RevenueSubscriptionRecord[],
  ): Promise<T> {
    if (!this.connect || this.modes.subscriptions === "json") return run(this.json.subscriptions);

    if (this.modes.subscriptions === "shadow") {
      const value = await run(this.json.subscriptions);
      this.inBackground(this.compareRead(run, recordsOf, value));
      return value;
    }

    // postgres: the callers of this repository are payment flows, which must read what they are
    // about to overwrite from the store in charge. No fallback: the event is retried instead.
    if (!(await this.ensureReady()) || !this.pg) throw this.refused();
    try {
      return await run(this.pg.subscriptions);
    } catch (error) {
      throw this.refused(error);
    }
  }

  /** Counts a payment-flow request turned away because PostgreSQL is in charge and unreachable. */
  private refused(cause?: unknown): DatabaseUnavailableError {
    this.counters.writeFailures += 1;
    if (cause !== undefined) this.ready = false;
    return new DatabaseUnavailableError(undefined, cause === undefined ? undefined : { cause });
  }

  private async compareRead<T>(
    run: (repository: SubscriptionRepository) => Promise<T>,
    recordsOf: (value: T) => RevenueSubscriptionRecord[],
    dataFileValue: T,
  ): Promise<void> {
    if (!this.ready || !this.pg) return;
    const differs = (left: T, right: T) => {
      const a = recordsOf(left);
      const b = new Map(recordsOf(right).map((record) => [record.id, record]));
      return a.length !== b.size || a.some((record) => !b.has(record.id) || !sameSubscription(record, b.get(record.id) as RevenueSubscriptionRecord));
    };
    try {
      if (!differs(dataFileValue, await run(this.pg.subscriptions))) return;
      // A write may have been between its two stores. Look again before calling it a difference.
      await sleep(this.recheckAfterMs);
      if (!differs(await run(this.json.subscriptions), await run(this.pg.subscriptions))) return;
      this.counters.readMismatches += 1;
      this.log("a subscription read differed between the data file and PostgreSQL (run the parity check)");
    } catch {
      // A comparison that cannot run is not a difference; the mirror counters cover outages.
    }
  }

  private async ledgerRead<T>(run: (repository: TerritoryLedgerRepository) => Promise<T>): Promise<T> {
    if (!this.connect || this.modes.ledger !== "postgres") return run(this.json.ledger);
    if ((await this.ensureReady()) && this.pg) {
      try {
        return await run(this.pg.ledger);
      } catch {
        this.ready = false;
      }
    }
    return run(this.json.ledger);
  }

  private async compareLedger(dataFileAnswer: Set<string>): Promise<void> {
    if (!(await this.ensureReady()) || !this.pg) return;
    const differs = (dataFile: Set<string>, postgres: Set<string>) =>
      dataFile.size !== postgres.size || [...dataFile].some((zip) => !postgres.has(zip));
    try {
      if (!differs(dataFileAnswer, await this.pg.ledger.paidClaimedZips(this.clock()))) return;
      await sleep(this.recheckAfterMs);
      const now = this.clock();
      if (!differs(await this.json.ledger.paidClaimedZips(now), await this.pg.ledger.paidClaimedZips(now))) return;
      this.counters.ledgerMismatches += 1;
      this.log("the ZIP code ledger differed between the data file and PostgreSQL (run the parity check)");
    } catch {
      // See compareRead.
    }
  }

  // ---- writes ---------------------------------------------------------------------------

  /** Runs one write on the store in charge, then copies the stored record to the other store. */
  private async write(
    input: RevenueSubscriptionRecord,
    run: (repository: SubscriptionRepository) => Promise<RevenueSubscriptionRecord>,
  ): Promise<void> {
    if (!this.connect || this.modes.subscriptions === "json") {
      await run(this.json.subscriptions);
      return;
    }

    if (this.modes.subscriptions === "shadow") {
      const stored = await run(this.json.subscriptions);
      await this.mirror("postgres", stored);
      return;
    }

    if (!(await this.ensureReady()) || !this.pg) throw this.refused();
    let stored: RevenueSubscriptionRecord;
    try {
      stored = await run(this.pg.subscriptions);
    } catch (error) {
      if (error instanceof RecordNotStorableError) throw error;
      this.log(`write for subscription ${input.id} refused: the database did not accept it`);
      throw this.refused(error);
    }
    await this.mirror("json", stored);
  }

  /** Copies one stored record to the store that is not in charge. Never fails the request. */
  private async mirror(to: Authority, record: RevenueSubscriptionRecord): Promise<void> {
    try {
      if (to === "postgres") {
        if (!(await this.ensureReady()) || !this.pg) throw new DatabaseUnavailableError();
        if (this.needsResync) {
          await this.synchronise("json");
          this.needsResync = false;
        } else {
          await this.pg.subscriptions.save(record);
        }
      } else if (this.needsResync) {
        await this.synchronise("postgres");
        this.needsResync = false;
      } else {
        await this.json.subscriptions.save(record);
      }
    } catch (error) {
      this.counters.mirrorFailures += 1;
      this.needsResync = true;
      if (to === "postgres") this.ready = false;
      this.log(`copy of subscription ${record.id} to ${to} failed (${error instanceof Error ? error.name : "error"}); it will be re-copied`);
    }
    if (this.modes.ledger === "postgres") await refreshLedgerReadModel();
  }

  private inBackground(task: Promise<unknown>): void {
    const tracked = task.catch(() => undefined).finally(() => this.background.delete(tracked));
    this.background.add(tracked);
  }
}
