import {
  configureLedgerReadModel,
  ledgerReadModelStatus,
  refreshLedgerReadModel,
  setLedgerSnapshot,
} from "@/lib/persistence/ledger-read-model";
import type { PersistenceModes } from "@/lib/persistence/mode";
import { runSchemaMigrations } from "@/lib/persistence/schema";
import { DatabaseUnavailableError, isConnectionError, isDataError, type SqlClient } from "@/lib/persistence/sql-client";
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
 *             re-copy before the next write or at the next periodic check.
 *   postgres  PostgreSQL decides. Each write is then copied back to the data file.
 *             If PostgreSQL cannot be reached a payment event is refused (Stripe redelivers it),
 *             because letting the data file decide alone would split the two stores. ZIP code
 *             availability and every dashboard keep answering from the data file's copy.
 *
 * Who is in charge is recorded in two places: in PostgreSQL (`persistence_state`) and in a small
 * marker beside the data file. The marker is what makes a rollback safe when PostgreSQL cannot be
 * reached: while it says PostgreSQL was in charge, the data file takes no payment writes until
 * PostgreSQL's copy has been brought over, or a person declares the data file to be the truth
 * (YPN_ACCEPT_DATA_FILE_AS_TRUTH). Without that, writes accepted by the data file during an
 * outage would be overwritten by PostgreSQL's older copy when it came back.
 *
 * Every write and every store-to-store copy runs one at a time (`serial`), so a copy can never
 * put an older version of a record over a newer one.
 */

export type Authority = "json" | "postgres";

/** A small durable note beside the data file: which store was in charge when this server last finished starting. */
export interface AuthorityMarker {
  read(): { authority: Authority; forced?: boolean } | null;
  write(value: { authority: Authority; forced?: boolean }): void;
}

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
  /** Compared as (ZIP code, holder) pairs, so a ZIP code held by a different customer in each store shows up. */
  ledger: { dataFile: number; postgres: number; onlyInDataFile: string[]; onlyInPostgres: string[] };
  /** Stripe subscription ids that appear on more than one record in either store. Not a difference between stores. */
  duplicateStripeSubscriptions: number;
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

export interface LatencyStat {
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
}

export interface PersistenceStatus {
  /** A database connection is configured (DATABASE_URL). */
  configured: boolean;
  ledger: PersistenceModes["ledger"];
  subscriptions: PersistenceModes["subscriptions"];
  /** Connected, tables in place, and the two stores brought in line since this process started. */
  ready: boolean;
  /**
   * The data file may not take payment writes: PostgreSQL was in charge last and its copy has not
   * been brought over yet. Clears by itself once PostgreSQL is reachable.
   */
  handoverPending: boolean;
  /** A switch to PostgreSQL was refused because some records could not be copied. Needs a person. */
  handoverBlocked: boolean;
  parity: { clean: boolean; mismatches: number; checkedAt: string } | null;
  /** Differences found the last time the stores were compared before any repair. */
  driftDetected: number;
  /** Copies to the other store that failed since start. Each is repaired by a later re-copy. */
  mirrorFailures: number;
  /** Payment-flow reads and writes refused because the store in charge could not be used. */
  writeFailures: number;
  /** Subscription reads in shadow mode whose PostgreSQL copy differed. */
  readMismatches: number;
  ledgerMismatches: number;
  /** Times the ZIP code ledger answered from the data file because PostgreSQL had no fresh answer. */
  ledgerFallbacks: number;
  /** Records the last copy could not store, and ZIP codes the ledger left with an earlier holder. */
  unstorableRecords: number;
  refusedClaims: number;
  duplicateStripeSubscriptions: number;
  latency: { postgresWrite: LatencyStat; postgresRead: LatencyStat; mirror: LatencyStat };
}

export interface PersistenceOptions {
  modes: PersistenceModes;
  json: { subscriptions: SubscriptionRepository; ledger: TerritoryLedgerRepository };
  /** Opens the PostgreSQL connection. Null when no database is configured. */
  connect: (() => Promise<SqlClient>) | null;
  /** Where "who was in charge" is kept beside the data file. Defaults to memory (tests). */
  localAuthority?: AuthorityMarker;
  /** A person has declared the data file to be the truth (YPN_ACCEPT_DATA_FILE_AS_TRUTH). */
  acceptDataFileAsTruth?: boolean;
  clock?: () => number;
  /** Wait this long after a failed start before trying the database again. */
  retryAfterMs?: number;
  /** How long to wait before re-checking a difference, so a write in flight is not reported. */
  recheckAfterMs?: number;
  /** How often the two stores are compared (and repaired) while running. 0 turns the timer off. */
  parityEveryMs?: number;
  /** The longest a request waits for the ZIP code ledger to reload after its own write. */
  ledgerRefreshWaitMs?: number;
  log?: (message: string) => void;
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

function memoryMarker(): AuthorityMarker {
  let value: { authority: Authority; forced?: boolean } | null = null;
  return { read: () => value, write: (next) => void (value = next) };
}

export class Persistence {
  readonly subscriptions: SubscriptionRepository;
  readonly ledger: TerritoryLedgerRepository;

  private readonly modes: PersistenceModes;
  private readonly json: PersistenceOptions["json"];
  private readonly connect: PersistenceOptions["connect"];
  private readonly local: AuthorityMarker;
  private readonly clock: () => number;
  private readonly retryAfterMs: number;
  private readonly recheckAfterMs: number;
  private readonly parityEveryMs: number;
  private readonly ledgerRefreshWaitMs: number;
  private readonly log: (message: string) => void;

  private pg: { client: SqlClient; subscriptions: PostgresSubscriptionRepository; ledger: PostgresTerritoryLedgerRepository } | null = null;
  private ready = false;
  private starting: Promise<boolean> | null = null;
  private lastAttemptAt = Number.NEGATIVE_INFINITY;
  /** The store that is not in charge missed at least one write and needs a full re-copy. */
  private needsResync = false;
  /** Counts writes, so a start-up copy knows whether one landed while it ran. */
  private writeSeq = 0;
  private handoverBlocked = false;
  private parity: ParityReport | null = null;
  private lastSync: SyncReport | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Writes and store-to-store copies run one at a time through this chain. */
  private queue: Promise<unknown> = Promise.resolve();
  private readonly background = new Set<Promise<unknown>>();
  private readonly counters = { mirrorFailures: 0, writeFailures: 0, readMismatches: 0, ledgerMismatches: 0, driftDetected: 0 };
  private readonly timings = { postgresWrite: new Timing(), postgresRead: new Timing(), mirror: new Timing() };

  constructor(options: PersistenceOptions) {
    this.modes = options.modes;
    this.json = options.json;
    this.connect = options.connect;
    this.local = options.localAuthority ?? memoryMarker();
    this.clock = options.clock ?? Date.now;
    this.retryAfterMs = options.retryAfterMs ?? 10_000;
    this.recheckAfterMs = options.recheckAfterMs ?? 250;
    this.parityEveryMs = options.parityEveryMs ?? 5 * 60_000;
    this.ledgerRefreshWaitMs = options.ledgerRefreshWaitMs ?? 2_000;
    this.log = options.log ?? ((message) => console.log(`[persistence] ${message}`));

    // A person's explicit decision that PostgreSQL's copy is to be discarded. It only means
    // something while the data file is meant to be in charge and the marker says it was not.
    if (options.acceptDataFileAsTruth && this.desiredAuthority === "json" && this.local.read()?.authority === "postgres") {
      this.local.write({ authority: "json", forced: true });
      this.log("YPN_ACCEPT_DATA_FILE_AS_TRUTH is set: the data file is now in charge and PostgreSQL's copy will be replaced by it");
    }
    if (this.handoverPending && !this.connect) {
      this.log(
        "PostgreSQL was in charge and no database is configured: payment writes are refused. Restore DATABASE_URL, or set YPN_ACCEPT_DATA_FILE_AS_TRUTH=1 to continue on the data file's copy.",
      );
    }

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
      paidHolders: (now = this.clock()) => this.ledgerRead((repository) => repository.paidHolders(now)),
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
            // Never waits for start-up: start-up itself loads the ledger, and waiting here for
            // start-up while start-up waited for this load would stop both for good.
            load: async () => {
              if (!this.ready || !this.pg) {
                void this.ensureReady();
                throw new DatabaseUnavailableError();
              }
              try {
                return await this.pg.ledger.paidClaimedZips(this.clock());
              } catch (error) {
                this.noteDatabaseError(error);
                throw error;
              }
            },
            compare: (dataFileAnswer) => this.inBackground(this.compareLedger(dataFileAnswer)),
          }
        : null,
    );
    return this;
  }

  /** Connects, prepares the tables and brings the two stores in line. Never throws. */
  start(): Promise<boolean> {
    if (!this.timer && this.connect && this.modes.subscriptions !== "json" && this.parityEveryMs > 0) {
      this.timer = setInterval(() => this.inBackground(this.maintain()), this.parityEveryMs);
      this.timer.unref?.();
    }
    return this.ensureReady();
  }

  /** Waits for background work. For tests and for a clean shutdown. */
  async settle(): Promise<void> {
    while (this.background.size > 0) await Promise.allSettled([...this.background]);
    await this.queue.catch(() => undefined);
  }

  async close(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
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
      handoverPending: this.handoverPending,
      handoverBlocked: this.handoverBlocked,
      parity: parity ? { clean: parity.clean, mismatches: mismatchCount(parity), checkedAt: parity.checkedAt } : null,
      driftDetected: this.counters.driftDetected,
      mirrorFailures: this.counters.mirrorFailures,
      writeFailures: this.counters.writeFailures,
      readMismatches: this.counters.readMismatches,
      ledgerMismatches: this.counters.ledgerMismatches,
      ledgerFallbacks: readModel.fallbacks,
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

  /** Compares the two stores in full and remembers the result. Null when PostgreSQL is not ready. */
  async checkParity(): Promise<ParityReport | null> {
    if (!(await this.ensureReady()) || !this.pg) return null;
    const report = await this.measureParity();
    this.parity = report;
    return report;
  }

  /**
   * The periodic check: compare the two stores, and when they differ, copy from the store in
   * charge to the other and compare again. This is what catches drift after start-up, in every
   * mode. A difference seen twice (so not a write in flight) is counted as drift before it is
   * repaired. Never throws.
   */
  async maintain(): Promise<ParityReport | null> {
    if (!this.connect || this.modes.subscriptions === "json") return null;
    if (!(await this.ensureReady()) || !this.pg) return null;
    try {
      let report = await this.measureParity();
      if (!report.clean) {
        await sleep(this.recheckAfterMs);
        report = await this.serial(() => this.measureParity());
      }
      if (!report.clean || this.needsResync) {
        if (!report.clean) {
          this.counters.driftDetected += mismatchCount(report);
          this.logDifferences("the stores differ; copying from the store in charge", report);
        }
        const authority = this.desiredAuthority;
        report = await this.serial(async () => {
          await this.synchroniseNow(authority, true);
          this.needsResync = false;
          return this.measureParity();
        });
        if (!report.clean) this.logDifferences("differences a copy could not fix (they need a person)", report);
      }
      this.parity = report;
      if (this.modes.ledger === "postgres") await refreshLedgerReadModel({ fresh: true });
      return report;
    } catch (error) {
      this.noteDatabaseError(error);
      this.log(`periodic check failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Copies every subscription that is missing or different from one store to the other.
   * Records only the other store holds are left alone and show up in the parity report.
   * `repair` re-saves every record even when it looks unchanged, which rebuilds the ZIP code ledger.
   */
  synchronise(from: Authority, repair = false): Promise<SyncReport> {
    return this.serial(() => this.synchroniseNow(from, repair));
  }

  // ---- comparing ------------------------------------------------------------------------

  private async measureParity(): Promise<ParityReport> {
    if (!this.pg) throw new DatabaseUnavailableError();
    const now = this.clock();
    const [dataFile, postgres, dataFileLedger, postgresLedger] = await Promise.all([
      this.json.subscriptions.list(),
      this.pg.subscriptions.list(),
      this.json.ledger.paidHolders(now),
      this.pg.ledger.paidHolders(now),
    ]);
    const inPostgres = new Map(postgres.map((record) => [record.id, record]));
    const inDataFile = new Map(dataFile.map((record) => [record.id, record]));
    const different: ParityReport["subscriptions"]["different"] = [];
    for (const record of dataFile) {
      const other = inPostgres.get(record.id);
      if (other && !sameSubscription(record, other)) different.push({ id: record.id, fields: differingFields(record, other) });
    }
    const pairs = (ledger: Map<string, string[]>) => new Set([...ledger].flatMap(([zip, holders]) => holders.map((holder) => `${zip} ${holder}`)));
    const left = pairs(dataFileLedger);
    const right = pairs(postgresLedger);
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
        dataFile: left.size,
        postgres: right.size,
        onlyInDataFile: [...left].filter((pair) => !right.has(pair)).sort(),
        onlyInPostgres: [...right].filter((pair) => !left.has(pair)).sort(),
      },
      duplicateStripeSubscriptions: Math.max(duplicateStripeIds(dataFile), duplicateStripeIds(postgres)),
    };
    report.clean = mismatchCount(report) === 0;
    return report;
  }

  private logDifferences(what: string, report: ParityReport): void {
    this.log(
      `${what}: ${JSON.stringify({
        subscriptions: {
          onlyInDataFile: report.subscriptions.onlyInDataFile.slice(0, LIST_LIMIT),
          onlyInPostgres: report.subscriptions.onlyInPostgres.slice(0, LIST_LIMIT),
          different: report.subscriptions.different.slice(0, LIST_LIMIT),
        },
        // ZIP codes only: the holder ids stay out of the log.
        ledgerZips: {
          onlyInDataFile: [...new Set(report.ledger.onlyInDataFile.map((pair) => pair.split(" ")[0]))].slice(0, LIST_LIMIT),
          onlyInPostgres: [...new Set(report.ledger.onlyInPostgres.map((pair) => pair.split(" ")[0]))].slice(0, LIST_LIMIT),
        },
      })}`,
    );
  }

  // ---- copying --------------------------------------------------------------------------

  private async synchroniseNow(from: Authority, repair: boolean): Promise<SyncReport> {
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
        // One record the target cannot hold (a bad date, a value outside what the table
        // allows) must not stop the rest. Anything else is the database itself: stop.
        if (!(error instanceof RecordNotStorableError) && !isDataError(error)) throw error;
        report.failed.push(record.id);
      }
    }
    this.lastSync = report;
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

  /** Runs one piece of work after everything queued before it. A failure does not block the queue. */
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  // ---- start-up -------------------------------------------------------------------------

  private get desiredAuthority(): Authority {
    return this.modes.subscriptions === "postgres" ? "postgres" : "json";
  }

  /** True while the data file must not decide a payment: PostgreSQL was in charge and has not handed back. */
  private get handoverPending(): boolean {
    return this.desiredAuthority === "json" && this.local.read()?.authority === "postgres";
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
      const pg = this.pg;
      const applied = await runSchemaMigrations(pg.client);
      if (applied.length > 0) this.log(`applied database migrations: ${applied.join(", ")}`);

      const stored = await this.storedAuthority();
      // Whether PostgreSQL was being kept in step when this server last ran. Only then is a
      // difference found at start "drift"; otherwise it is the first copy, which is expected.
      const wasInStep = (await this.storedState("in_step")) === "true";
      const desired = this.desiredAuthority;
      const marker = this.local.read();
      // Which store holds the truth right now: PostgreSQL's own record, unless a person has
      // declared the data file to be the truth.
      const truth: Authority = marker?.forced ? "json" : stored;
      const seqAtStart = this.writeSeq;

      await this.serial(async () => {
        if (truth !== desired) {
          // Hand-over: copy everything from the store that was in charge before the newly
          // chosen store decides anything.
          const handover = await this.synchroniseNow(truth, truth === "json");
          if (desired === "postgres" && (handover.failed.length > 0 || handover.refusedClaims.length > 0)) {
            // PostgreSQL would be missing plans or ZIP code locks the data file has, and could
            // sell a held ZIP code again. Do not let it take over.
            this.handoverBlocked = true;
            throw new Error(
              `hand-over to PostgreSQL refused: ${handover.failed.length} record(s) could not be stored and ${handover.refusedClaims.length} ZIP code claim(s) were refused. Fix them (see the log line above) or go back to shadow.`,
            );
          }
          this.log(`hand-over from ${truth} to ${desired}: ${handover.copied} copied, ${handover.unchanged} already in step`);
        }
        this.handoverBlocked = false;
        if (stored !== desired) {
          // Marker first when PostgreSQL takes over: if the process dies between the two writes,
          // the data file must already know it is no longer in charge.
          if (desired === "postgres") this.local.write({ authority: "postgres" });
          await this.storeState("authority", desired);
        }
        this.local.write({ authority: desired });

        // Keep the other store in step. In json mode PostgreSQL is not kept up to date at all.
        if (this.modes.subscriptions !== "json") {
          const before = await this.measureParity();
          if (!before.clean && truth === desired && wasInStep) {
            // Nothing was switched and the copy was being kept up, so the two should match: this is drift.
            this.counters.driftDetected += mismatchCount(before);
            this.logDifferences("the stores differed at start; copying from the store in charge", before);
          }
          const sync = await this.synchroniseNow(desired, !before.clean);
          this.parity = await this.measureParity();
          this.log(
            `ready (ledger=${this.modes.ledger}, subscriptions=${this.modes.subscriptions}): ${sync.copied} copied, ${sync.unchanged} already in step, parity ${this.parity.clean ? "clean" : "NOT clean"}`,
          );
          if (!this.parity.clean) this.logDifferences("differences a copy could not fix (they need a person)", this.parity);
          if (!wasInStep) await this.storeState("in_step", "true");
        } else {
          // PostgreSQL is not written in json mode, so from here on it is knowingly out of date.
          if (wasInStep) await this.storeState("in_step", "false");
          this.log("database reachable and tables in place; the data file is still the only store in use");
        }
        // A write that landed while this ran may have been copied before the lists were read.
        this.needsResync = this.writeSeq !== seqAtStart && this.modes.subscriptions !== "json";
        if (this.modes.ledger === "postgres") setLedgerSnapshot(await pg.ledger.paidClaimedZips(this.clock()));
      });
      this.ready = true;
      return true;
    } catch (error) {
      this.ready = false;
      this.log(`database not ready: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private async storedAuthority(): Promise<Authority> {
    return (await this.storedState("authority")) === "postgres" ? "postgres" : "json";
  }

  private async storedState(key: string): Promise<string | undefined> {
    if (!this.pg) throw new DatabaseUnavailableError();
    const { rows } = await this.pg.client.query<{ value: string }>("select value from persistence_state where key = $1", [key]);
    return rows[0]?.value;
  }

  private async storeState(key: string, value: string): Promise<void> {
    if (!this.pg) throw new DatabaseUnavailableError();
    await this.pg.client.query(
      `insert into persistence_state (key, value) values ($1, $2)
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [key, value],
    );
  }

  /** Only a lost connection means "not ready". A rejected record or statement does not. */
  private noteDatabaseError(error: unknown): void {
    if (isConnectionError(error)) this.ready = false;
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
    const pg = this.pg;
    try {
      return await this.timings.postgresRead.measure(() => run(pg.subscriptions));
    } catch (error) {
      throw this.refused(error);
    }
  }

  /** Counts a payment-flow request turned away because the store in charge could not be used. */
  private refused(cause?: unknown): DatabaseUnavailableError {
    this.counters.writeFailures += 1;
    if (cause !== undefined) this.noteDatabaseError(cause);
    return new DatabaseUnavailableError(undefined, cause === undefined ? undefined : { cause });
  }

  private async compareRead<T>(
    run: (repository: SubscriptionRepository) => Promise<T>,
    recordsOf: (value: T) => RevenueSubscriptionRecord[],
    dataFileValue: T,
  ): Promise<void> {
    if (!this.ready || !this.pg) return;
    const pg = this.pg;
    const differs = (left: T, right: T) => {
      const a = recordsOf(left);
      const b = new Map(recordsOf(right).map((record) => [record.id, record]));
      return a.length !== b.size || a.some((record) => !b.has(record.id) || !sameSubscription(record, b.get(record.id) as RevenueSubscriptionRecord));
    };
    try {
      if (!differs(dataFileValue, await run(pg.subscriptions))) return;
      // A write may have been between its two stores. Look again, after it, before calling it a difference.
      await sleep(this.recheckAfterMs);
      const still = await this.serial(async () => differs(await run(this.json.subscriptions), await run(pg.subscriptions)));
      if (!still) return;
      this.counters.readMismatches += 1;
      this.log("a subscription read differed between the data file and PostgreSQL (the periodic check will repair it)");
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
        this.noteDatabaseError(error);
      }
    }
    return run(this.json.ledger);
  }

  private async compareLedger(dataFileAnswer: Set<string>): Promise<void> {
    if (!this.ready || !this.pg) return;
    const pg = this.pg;
    const differs = (dataFile: Set<string>, postgres: Set<string>) =>
      dataFile.size !== postgres.size || [...dataFile].some((zip) => !postgres.has(zip));
    try {
      if (!differs(dataFileAnswer, await pg.ledger.paidClaimedZips(this.clock()))) return;
      await sleep(this.recheckAfterMs);
      const still = await this.serial(async () => {
        const now = this.clock();
        return differs(await this.json.ledger.paidClaimedZips(now), await pg.ledger.paidClaimedZips(now));
      });
      if (!still) return;
      this.counters.ledgerMismatches += 1;
      this.log("the ZIP code ledger differed between the data file and PostgreSQL (the periodic check will repair it)");
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
    if (this.desiredAuthority === "json") {
      // PostgreSQL was in charge and has not handed its copy back: the data file may hold an
      // older version of this very record. Refuse; Stripe redelivers once the hand-over has run.
      if (this.handoverPending) {
        void this.ensureReady();
        throw this.refused();
      }
      if (!this.connect || this.modes.subscriptions === "json") {
        await run(this.json.subscriptions);
        return;
      }
      await this.serial(async () => {
        const stored = await run(this.json.subscriptions);
        this.writeSeq += 1;
        await this.mirror("postgres", stored);
      });
      await this.refreshLedgerAfterWrite();
      return;
    }

    if (!(await this.ensureReady()) || !this.pg) throw this.refused();
    const pg = this.pg;
    await this.serial(async () => {
      let stored: RevenueSubscriptionRecord;
      try {
        stored = await this.timings.postgresWrite.measure(() => run(pg.subscriptions));
      } catch (error) {
        if (error instanceof RecordNotStorableError) throw error;
        this.log(`write for subscription ${input.id} refused: the database did not accept it`);
        throw this.refused(error);
      }
      this.writeSeq += 1;
      await this.mirror("json", stored);
    });
    await this.refreshLedgerAfterWrite();
  }

  /**
   * Copies one stored record to the store that is not in charge. Never fails the request, and
   * never waits for the database to come back: a copy that cannot be made now is made later.
   * Called from inside `serial`.
   */
  private async mirror(to: Authority, record: RevenueSubscriptionRecord): Promise<void> {
    try {
      await this.timings.mirror.measure(async () => {
        if (to === "postgres") {
          if (!this.ready || !this.pg) {
            // Start-up copies everything, so nothing is lost by not waiting for it here.
            void this.ensureReady();
            throw new DatabaseUnavailableError();
          }
          if (this.needsResync) {
            await this.synchroniseNow("json", false);
            this.needsResync = false;
          } else {
            await this.pg.subscriptions.save(record);
          }
        } else if (this.needsResync) {
          await this.synchroniseNow("postgres", false);
          this.needsResync = false;
        } else {
          await this.json.subscriptions.save(record);
        }
      });
    } catch (error) {
      this.counters.mirrorFailures += 1;
      this.needsResync = true;
      if (to === "postgres") this.noteDatabaseError(error);
      this.log(`copy of subscription ${record.id} to ${to} did not happen (${error instanceof Error ? error.name : "error"}); it will be re-copied`);
    }
  }

  /** After this process's own write, the next ZIP code check must see it. Waits a bounded time. */
  private async refreshLedgerAfterWrite(): Promise<void> {
    if (this.modes.ledger !== "postgres") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, this.ledgerRefreshWaitMs);
      timer.unref?.();
    });
    await Promise.race([refreshLedgerReadModel({ fresh: true }), limit]);
    clearTimeout(timer);
  }

  private inBackground(task: Promise<unknown>): void {
    const tracked = task.catch(() => undefined).finally(() => this.background.delete(tracked));
    this.background.add(tracked);
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

function duplicateStripeIds(records: RevenueSubscriptionRecord[]): number {
  const seen = new Map<string, number>();
  for (const record of records) {
    if (record.stripeSubscriptionId) seen.set(record.stripeSubscriptionId, (seen.get(record.stripeSubscriptionId) ?? 0) + 1);
  }
  return [...seen.values()].filter((count) => count > 1).length;
}
