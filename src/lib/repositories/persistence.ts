import { configureLedgerReadModel, ledgerReadModelStatus, refreshLedgerReadModel } from "@/lib/persistence/ledger-read-model";
import type { PersistenceModes } from "@/lib/persistence/mode";
import { runSchemaMigrations } from "@/lib/persistence/schema";
import { DatabaseUnavailableError, isConnectionError, isDataError, type SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import { PostgresSubscriptionRepository, PostgresTerritoryLedgerRepository } from "./postgres-repositories";
import { RecordNotStorableError, StaleWriteError, differingFields, sameSubscription } from "./subscription-record";
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
 * is copied in full to the other before anything else happens. The data file keeps its own note
 * of that (AuthorityMarker): after PostgreSQL has been in charge, a switch back refuses payment
 * events until the hand-over has run, so an event accepted during a database outage can never
 * be overwritten by the older copy when the database returns.
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
  /**
   * Stripe subscriptions that more than one plan record points at, in whichever store has more.
   * Not a difference between the stores (both can hold the same duplicates), so it does not make
   * the report unclean; it is reported because a duplicate is a plan someone may be billed twice for.
   */
  duplicateStripeSubscriptions: number;
}

/** How long one kind of database operation takes, since this process started. Milliseconds. */
export interface LatencyStat {
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
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
  /** Payment-flow reads and writes refused because PostgreSQL was in charge (or still owed its hand-over) and unreachable. */
  writeFailures: number;
  /** The data file's copy missed a write PostgreSQL decided and has not yet been re-copied to disk. */
  dataFileBehind: boolean;
  /** Subscription reads in shadow mode whose PostgreSQL copy differed. */
  readMismatches: number;
  ledgerMismatches: number;
  /** Times the ZIP code ledger answered from the data file because PostgreSQL had no fresh answer. */
  ledgerFallbacks: number;
  /**
   * PostgreSQL was told to take charge but was not allowed to: the copy from the data file left
   * plans it could not store, or ZIP code claims it refused. Payment events are refused until a
   * person fixes those records or goes back to shadow.
   */
  handoverBlocked: boolean;
  /** Differences the scheduled comparison found after start-up (counted before they are repaired). */
  driftDetected: number;
  /** Plans the last full copy could not store in the other store. */
  unstorableRecords: number;
  /** ZIP code claims the last full copy to PostgreSQL refused because another holder has the ZIP code. */
  refusedClaims: number;
  /** See ParityReport. 0 until the stores have been compared. */
  duplicateStripeSubscriptions: number;
  latency: { postgresWrite: LatencyStat; postgresRead: LatencyStat; mirror: LatencyStat };
}

/**
 * The data file's own durable note of which store was in charge last. It is read when the
 * database cannot be, so a switch back to the data file during an outage knows it still owes a
 * hand-over. Null in a deployment that has never used PostgreSQL behaves as "json".
 */
export interface AuthorityMarker {
  read(): Authority;
  /** Must be on disk when it returns. Throws when it cannot be written. */
  write(value: Authority): void;
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
  /**
   * While PostgreSQL is being kept in step (shadow or postgres), compare the two stores this
   * often, so drift during a days-long shadow run shows in /api/health instead of only at the
   * next restart. 0 turns it off. Default 5 minutes.
   */
  parityEveryMs?: number;
  log?: (message: string) => void;
  /** See AuthorityMarker. Without one, nothing is refused on a switch back (tests that do not need it). */
  authorityMarker?: AuthorityMarker | null;
}

const LIST_LIMIT = 20;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class Timing {
  private count = 0;
  private total = 0;
  private max = 0;
  private last = 0;
  async measure<T>(run: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await run();
    } finally {
      const elapsed = performance.now() - started;
      this.count += 1;
      this.total += elapsed;
      this.last = elapsed;
      if (elapsed > this.max) this.max = elapsed;
    }
  }
  stat(): LatencyStat {
    const round = (value: number) => Math.round(value * 10) / 10;
    return { count: this.count, avgMs: this.count ? round(this.total / this.count) : 0, maxMs: round(this.max), lastMs: round(this.last) };
  }
}

function mismatchCount(report: ParityReport): number {
  return (
    report.subscriptions.onlyInDataFile.length +
    report.subscriptions.onlyInPostgres.length +
    report.subscriptions.different.length +
    report.ledger.onlyInDataFile.length +
    report.ledger.onlyInPostgres.length
  );
}

/** How many Stripe subscriptions have more than one plan record. */
function duplicateStripeIds(records: RevenueSubscriptionRecord[]): number {
  const seen = new Map<string, number>();
  for (const record of records) {
    if (record.stripeSubscriptionId) seen.set(record.stripeSubscriptionId, (seen.get(record.stripeSubscriptionId) ?? 0) + 1);
  }
  return [...seen.values()].filter((count) => count > 1).length;
}

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
  private readonly marker: AuthorityMarker | null;
  private readonly parityEveryMs: number;
  private parityTimer: ReturnType<typeof setInterval> | null = null;
  private parityRunning = false;
  private warnedNoDatabaseForHandover = false;

  private pg: { client: SqlClient; subscriptions: PostgresSubscriptionRepository; ledger: PostgresTerritoryLedgerRepository } | null = null;
  private ready = false;
  private starting: Promise<boolean> | null = null;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  /** The store that is not in charge missed at least one write and needs a full re-copy. */
  private needsResync = false;
  private parity: ParityReport | null = null;
  private readonly background = new Set<Promise<unknown>>();
  private readonly counters = { mirrorFailures: 0, writeFailures: 0, readMismatches: 0, ledgerMismatches: 0, driftDetected: 0 };
  private readonly timings = { postgresWrite: new Timing(), postgresRead: new Timing(), mirror: new Timing() };
  /** See PersistenceStatus.handoverBlocked. */
  private handoverBlocked = false;
  /** The last full copy between the stores, for the health counts. */
  private lastSync: SyncReport | null = null;

  constructor(options: PersistenceOptions) {
    this.modes = options.modes;
    this.json = options.json;
    this.connect = options.connect;
    this.clock = options.clock ?? Date.now;
    this.retryAfterMs = options.retryAfterMs ?? 10_000;
    this.recheckAfterMs = options.recheckAfterMs ?? 250;
    this.log = options.log ?? ((message) => console.log(`[persistence] ${message}`));
    this.marker = options.authorityMarker ?? null;
    this.parityEveryMs = options.parityEveryMs ?? 5 * 60_000;

    this.subscriptions = {
      findById: (id) => this.read((repository) => repository.findById(id), (record) => (record ? [record] : [])),
      findByStripeSubscriptionId: (id) =>
        this.read((repository) => repository.findByStripeSubscriptionId(id), (record) => (record ? [record] : [])),
      list: () => this.read((repository) => repository.list(), (records) => records),
      save: (record, options) => this.write(record, (repository) => repository.save(record, options)),
      saveWithZipClaim: async (record, zip, options) => {
        let outcome!: ZipClaimOutcome;
        const stored = await this.write(record, async (repository) => {
          outcome = await repository.saveWithZipClaim(record, zip, options);
          return outcome.record;
        });
        return { ...outcome, record: stored };
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
  async start(): Promise<boolean> {
    const ready = await this.ensureReady();
    // After start-up has finished, never inside it: a ZIP code check made while it ran may
    // already be loading the ledger, and that load waits for start-up to finish.
    if (ready && this.modes.ledger === "postgres") await refreshLedgerReadModel();
    if (!this.parityTimer && this.connect && this.modes.subscriptions !== "json" && this.parityEveryMs > 0) {
      this.parityTimer = setInterval(() => void this.periodicParity(), this.parityEveryMs);
      this.parityTimer.unref?.();
    }
    return ready;
  }

  /**
   * One scheduled comparison. Waits for copies already in flight first, so a write caught
   * between the two stores is not reported as drift. Never throws and never overlaps itself.
   *
   * A difference seen twice (so not a write between its two stores) is counted in
   * `driftDetected` and logged, and then repaired: everything is copied again from the store in
   * charge to the other one, which is only ever a copy. What a copy cannot fix (a record only the
   * other store holds, a record it cannot store) stays in the parity report for a person.
   */
  async periodicParity(): Promise<ParityReport | null> {
    if (this.parityRunning) return null;
    this.parityRunning = true;
    try {
      await this.settle();
      let report = await this.checkParity();
      if (!report || report.clean) return report;
      await sleep(this.recheckAfterMs);
      await this.settle();
      report = await this.checkParity();
      if (!report || report.clean) return report;

      this.counters.driftDetected += mismatchCount(report);
      this.log(`the stores drifted apart (${mismatchCount(report)} difference(s)); copying again from the store in charge`);
      await this.synchronise(this.desiredAuthority, true);
      this.needsResync = false;
      const repaired = await this.checkParity();
      if (repaired && !repaired.clean) this.log("differences a copy could not fix remain (they need a person)");
      return repaired;
    } catch (error) {
      this.log(`scheduled parity check failed: ${error instanceof Error ? error.name : "error"}`);
      return null;
    } finally {
      this.parityRunning = false;
    }
  }

  /** Waits for background comparisons. For tests and for a clean shutdown. */
  async settle(): Promise<void> {
    while (this.background.size > 0) await Promise.allSettled([...this.background]);
  }

  async close(): Promise<void> {
    if (this.parityTimer) clearInterval(this.parityTimer);
    this.parityTimer = null;
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
      parity: parity ? { clean: parity.clean, mismatches: mismatchCount(parity), checkedAt: parity.checkedAt } : null,
      mirrorFailures: this.counters.mirrorFailures,
      writeFailures: this.counters.writeFailures,
      dataFileBehind: this.needsResync && this.desiredAuthority === "postgres",
      readMismatches: this.counters.readMismatches,
      ledgerMismatches: this.counters.ledgerMismatches,
      ledgerFallbacks: readModel.fallbacks,
      handoverBlocked: this.handoverBlocked,
      driftDetected: this.counters.driftDetected,
      unstorableRecords: this.lastSync?.failed.length ?? 0,
      refusedClaims: this.lastSync?.refusedClaims.length ?? 0,
      duplicateStripeSubscriptions: parity?.duplicateStripeSubscriptions ?? 0,
      latency: {
        postgresWrite: this.timings.postgresWrite.stat(),
        postgresRead: this.timings.postgresRead.stat(),
        mirror: this.timings.mirror.stat(),
      },
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
      duplicateStripeSubscriptions: Math.max(duplicateStripeIds(dataFile), duplicateStripeIds(postgres)),
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
        // One record the target cannot hold (an unreadable date, a value the database rejects)
        // must not stop the rest of the copy or be mistaken for an outage.
        if (!(error instanceof RecordNotStorableError) && !isDataError(error)) throw error;
        report.failed.push(record.id);
      }
    }
    // A copy to the data file counts only once it is on disk (it is the store a rollback returns to).
    if (from === "postgres") await this.json.subscriptions.flushDurably?.();
    if (report.failed.length > 0 || report.refusedClaims.length > 0) {
      this.log(
        `copy from ${from} left work for a person: ${JSON.stringify({
          failed: report.failed.slice(0, LIST_LIMIT),
          refusedClaims: report.refusedClaims.slice(0, LIST_LIMIT),
        })}`,
      );
    }
    this.lastSync = report;
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
    this.starting = this.boot()
      .finally(() => {
        this.starting = null;
      })
      .then((ready) => {
        // Not awaited, and only once start-up has settled (see start()).
        if (ready && this.modes.ledger === "postgres") void refreshLedgerReadModel();
        return ready;
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

      const stored = await this.storedAuthority();
      const desired = this.desiredAuthority;
      // The data file notes that PostgreSQL is in charge before PostgreSQL is told so: a crash in
      // between can only make a later switch back wait for the database, never skip a hand-over.
      if (desired === "postgres") this.writeMarker("postgres");

      // Hand-over: if the other store was in charge last time, it holds the truth. Copy it over
      // in full before this process lets the newly chosen store decide anything. A copy to the
      // data file counts only once it is on disk (synchronise throws otherwise).
      if (stored !== desired) {
        // From the data file, every plan is saved again even when its record already matches:
        // only that shows the ZIP code claims PostgreSQL refuses (two holders in old data).
        const handover = await this.synchronise(stored, stored === "json");
        if (desired === "postgres" && (handover.failed.length > 0 || handover.refusedClaims.length > 0)) {
          // PostgreSQL would be missing plans or ZIP code locks the data file has, and could sell
          // a held ZIP code again. It does not take charge. The data file is still the truth, so
          // its note says so again: going back to shadow, or removing DATABASE_URL, owes nothing.
          this.handoverBlocked = true;
          this.writeMarker("json");
          throw new Error(
            `hand-over to PostgreSQL refused: ${handover.failed.length} plan(s) could not be stored and ${handover.refusedClaims.length} ZIP code claim(s) were refused. Fix them (see the log line above) or go back to shadow`,
          );
        }
        this.log(`hand-over from ${stored} to ${desired}: ${handover.copied} copied, ${handover.unchanged} already in step`);
        await this.pg.client.query(
          `insert into persistence_state (key, value) values ('authority', $1)
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [desired],
        );
      }
      this.handoverBlocked = false;
      if (desired === "json") this.writeMarker("json");

      // Keep the other store in step. In json mode PostgreSQL is not kept up to date at all.
      let behind = false;
      if (this.modes.subscriptions !== "json") {
        let sync: SyncReport | null = null;
        try {
          sync = await this.synchronise(desired);
        } catch (error) {
          // The data file could not be written to disk. PostgreSQL still decides correctly; the
          // copy is retried on the next write and health reports it (dataFileBehind).
          if (desired !== "postgres" || error instanceof DatabaseUnavailableError) throw error;
          behind = true;
          this.counters.mirrorFailures += 1;
          this.log(`the data file's copy could not be written to disk (${error instanceof Error ? error.name : "error"}); it will be re-copied`);
        }
        this.ready = true;
        let parity = await this.checkParity();
        if (parity && !parity.clean && desired === "json") {
          // Same records but a different ledger means the claims table drifted: rebuild it once.
          await this.synchronise("json", true);
          parity = await this.checkParity();
        }
        this.log(
          `ready (ledger=${this.modes.ledger}, subscriptions=${this.modes.subscriptions}): ${sync?.copied ?? 0} copied, ${sync?.unchanged ?? 0} already in step, parity ${parity?.clean ? "clean" : "NOT clean"}`,
        );
      } else {
        this.ready = true;
        this.log("database reachable and tables in place; the data file is still the only store in use");
      }
      this.needsResync = behind;
      return true;
    } catch (error) {
      this.ready = false;
      this.log(`database not ready: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private writeMarker(value: Authority): void {
    if (!this.marker || this.marker.read() === value) return;
    this.marker.write(value);
  }

  /**
   * True while the data file is set to decide but PostgreSQL was in charge last and has not yet
   * handed over: the data file may be missing writes PostgreSQL accepted, and anything it accepted
   * now would be overwritten by the hand-over. Payment events are refused until it has run.
   */
  private owesHandover(): boolean {
    if (!this.marker || this.desiredAuthority !== "json" || this.marker.read() !== "postgres") return false;
    if (!this.connect) {
      if (!this.warnedNoDatabaseForHandover) {
        this.warnedNoDatabaseForHandover = true;
        this.log("PostgreSQL was in charge last but no database is configured: the data file decides alone from its own copy");
      }
      return false;
    }
    return true;
  }

  /** Runs the owed hand-over first, or refuses the request when the database cannot be reached. */
  private async settleHandover(): Promise<void> {
    if (!this.owesHandover()) return;
    if (!(await this.ensureReady()) || this.owesHandover()) {
      this.log("payment event refused: PostgreSQL was in charge last and the hand-over to the data file has not run yet");
      throw this.refused();
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
    await this.settleHandover();
    if (!this.connect || this.modes.subscriptions === "json") return run(this.json.subscriptions);

    if (this.modes.subscriptions === "shadow") {
      const value = await run(this.json.subscriptions);
      this.inBackground(this.compareRead(run, recordsOf, value));
      return value;
    }

    // postgres: the callers of this repository are payment flows, which must read what they are
    // about to overwrite from the store in charge. No fallback: the event is retried instead.
    if (!(await this.ensureReady()) || !this.pg) throw this.refused();
    const pg = this.pg;
    try {
      return await this.timings.postgresRead.measure(() => run(pg.subscriptions));
    } catch (error) {
      throw this.refused(error);
    }
  }

  /** Counts a payment-flow request turned away because PostgreSQL is in charge and unreachable. */
  private refused(cause?: unknown): DatabaseUnavailableError {
    this.counters.writeFailures += 1;
    // Only a lost connection means the database is down. A statement it rejected does not, and
    // must not send the next request through a full start-up again.
    if (cause !== undefined && isConnectionError(cause)) this.ready = false;
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
      } catch (error) {
        if (isConnectionError(error)) this.ready = false;
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

  /** Runs one write on the store in charge, then copies the stored record to the other store. Returns it as stored. */
  private async write(
    input: RevenueSubscriptionRecord,
    run: (repository: SubscriptionRepository) => Promise<RevenueSubscriptionRecord>,
  ): Promise<RevenueSubscriptionRecord> {
    await this.settleHandover();
    if (!this.connect || this.modes.subscriptions === "json") return run(this.json.subscriptions);

    if (this.modes.subscriptions === "shadow") {
      const stored = await run(this.json.subscriptions);
      await this.mirror("postgres", stored);
      return stored;
    }

    if (!(await this.ensureReady()) || !this.pg) throw this.refused();
    const pg = this.pg;
    let stored: RevenueSubscriptionRecord;
    try {
      stored = await this.timings.postgresWrite.measure(() => run(pg.subscriptions));
    } catch (error) {
      // Not an outage: the caller reads again and retries (stale), or the record is bad.
      if (error instanceof RecordNotStorableError || error instanceof StaleWriteError) throw error;
      this.log(`write for subscription ${input.id} refused: the database did not accept it`);
      throw this.refused(error);
    }
    await this.mirror("json", stored);
    return stored;
  }

  /**
   * Copies one stored record to the store that is not in charge. Never fails the request.
   * A copy to PostgreSQL is stored exactly as the data file has it; a copy to the data file
   * counts only once it is on disk. A copy that fails is repaired by a full re-copy later.
   */
  private async mirror(to: Authority, record: RevenueSubscriptionRecord): Promise<void> {
    try {
      await this.timings.mirror.measure(() => this.mirrorOnce(to, record));
    } catch (error) {
      this.counters.mirrorFailures += 1;
      this.needsResync = true;
      if (to === "postgres" && isConnectionError(error)) this.ready = false;
      this.log(`copy of subscription ${record.id} to ${to} failed (${error instanceof Error ? error.name : "error"}); it will be re-copied`);
    }
    if (this.modes.ledger === "postgres") await refreshLedgerReadModel();
  }

  private async mirrorOnce(to: Authority, record: RevenueSubscriptionRecord): Promise<void> {
    if (to === "postgres") {
      if (!(await this.ensureReady()) || !this.pg) throw new DatabaseUnavailableError();
      if (this.needsResync) {
        await this.synchronise("json");
        this.needsResync = false;
      } else {
        await this.pg.subscriptions.saveReportingSkippedClaims(record);
      }
    } else if (this.needsResync) {
      await this.synchronise("postgres");
      this.needsResync = false;
    } else if (this.json.subscriptions.saveDurably) {
      await this.json.subscriptions.saveDurably(record);
    } else {
      await this.json.subscriptions.save(record);
    }
  }

  private inBackground(task: Promise<unknown>): void {
    const tracked = task.catch(() => undefined).finally(() => this.background.delete(tracked));
    this.background.add(tracked);
  }
}
