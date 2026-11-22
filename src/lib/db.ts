import fs from "fs";
import { claimHolderKey, isLiveSubscription } from "@/lib/subscription-live";
import { openSnapshot, sealSnapshot } from "@/lib/crypto/pii-snapshot";
import type { Stats } from "fs";
import path from "path";
import type {
  AccountRecord,
  LoginTokenRecord,
  StarterKitRecord,
  OfficerProspectRecord,
  CerebroQueuedActionRecord,
  ConsentRecord,
  ProcessedKeyRecord,
  PushSubscriptionRecord,
  CrmConnectionRecord,
  CrmDeliveryRecord,
  FreeUsageRecord,
  LinkedInArticleRecord,
  MarketingKitRecord,
  SiteOverrideRecord,
  SiteOptimizerState,
  DbShape,
  AppointmentRecord,
  AgentOnboardingRecord,
  AnalyticsEventRecord,
  AutopilotRunRecord,
  PaymentConversionRecord,
  BorrowerLeadRecord,
  ChatSessionRecord,
  CrmLeadRecord,
  DemoRequestRecord,
  IntakeSessionRecord,
  LoanOfficerRecord,
  LoAlertRecord,
  PropertyEvaluationRecord,
  RevenueSubscriptionRecord,
  ScheduledFollowUpRecord,
  WebsiteAutopilotChange,
  ZipScarcityEventRecord,
} from "./types";

/**
 * Storage layer.
 *
 * The source of truth is an in-memory store held on the module scope. It is
 * hydrated once from disk (if a snapshot exists) and written through to disk on
 * every mutation on a best-effort basis.
 *
 * Why in-memory-first: keeping state in memory means multi-step flows (the
 * intake chat posting several `tick`s) stay coherent even if a disk write
 * fails. On a persistent Node host (`next start`, a VPS, Docker) the disk
 * snapshot additionally survives restarts. Set `LOANPILOT_DATA_DIR` to a
 * writable path to control where the snapshot lives.
 */

/**
 * Resolve the data directory lazily (not at module scope) so bundlers don't
 * trace `process.cwd()` as a build-time filesystem dependency.
 */
let cachedDataDir: string | null = null;
function dataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  const configured = process.env.LOANPILOT_DATA_DIR?.trim();
  if (configured) {
    cachedDataDir = configured;
    return cachedDataDir;
  }
  // Keep the data dir under ./data so NFT does not trace the whole repo.
  // Prefer resolve("data") over cwd()+join — Hostinger/standalone NFT treats
  // process.cwd() joins as whole-project traces even with turbopackIgnore.
  cachedDataDir = path.resolve(/*turbopackIgnore: true*/ "data");
  return cachedDataDir;
}
function dbPath(): string {
  return path.join(dataDir(), "store.json");
}

/**
 * Which store decided paid plans last, as noted beside the data file ("json" or "postgres").
 * Read when the database cannot be, so a switch back to the data file during a database outage
 * knows it still owes a hand-over (see src/lib/repositories/persistence.ts, AuthorityMarker).
 * No file: the data file has always decided. An unreadable file is read as "postgres", the
 * answer that makes a switch back wait for the database rather than risk overwriting a write.
 */
function persistenceAuthorityPath(): string {
  return path.join(dataDir(), "persistence-authority.json");
}

export function readPersistenceAuthorityNote(): "json" | "postgres" {
  let raw: string;
  try {
    raw = fs.readFileSync(/*turbopackIgnore: true*/ persistenceAuthorityPath(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return "json";
    return "postgres";
  }
  try {
    const parsed = JSON.parse(raw) as { authority?: unknown };
    return parsed.authority === "json" ? "json" : "postgres";
  } catch {
    return "postgres";
  }
}

/** Writes the note durably (temp file, fsync, rename). Throws when it cannot. */
export function writePersistenceAuthorityNote(value: "json" | "postgres"): void {
  if (!ensureDataDir()) throw new StoreNotDurableError("the data folder is not available");
  const target = persistenceAuthorityPath();
  const tmp = `${target}.${process.pid}.tmp`;
  const fd = fs.openSync(/*turbopackIgnore: true*/ tmp, "w");
  try {
    fs.writeSync(fd, JSON.stringify({ authority: value, updatedAt: new Date().toISOString() }));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(/*turbopackIgnore: true*/ tmp, target);
}

/** Private files the app keeps beside the store (not in backups or the web root), e.g. the Search Console key. */
export function secretsDir(): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), "secrets");
}

/** Loan officer headshots live beside the store: <data dir>/officer-photos/<accountId>.<ext>. */
export function officerPhotoDir(): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), "officer-photos");
}

const defaultLoanOfficers: LoanOfficerRecord[] = [
  {
    id: "lo_jordan_lee",
    name: "Jordan Lee",
    email: "jordan.lee@loanapilot.ai",
    specialties: ["FHA", "VA", "CONVENTIONAL", "REFI"],
    weeklyWindows: [
      { dow: 1, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 2, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 3, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 4, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 5, startMin: 9 * 60, endMin: 15 * 60 },
    ],
  },
  {
    id: "lo_priya_nandakumar",
    name: "Priya Nandakumar",
    email: "priya.n@loanapilot.ai",
    specialties: ["DSCR", "JUMBO"],
    weeklyWindows: [
      { dow: 1, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 2, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 3, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 4, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 5, startMin: 10 * 60, endMin: 16 * 60 },
    ],
  },
  {
    id: "lo_mateo_rosales",
    name: "Mateo Rosales",
    email: "mateo.r@loanapilot.ai",
    specialties: ["HELOC", "REFI", "FHA"],
    weeklyWindows: [
      { dow: 2, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 3, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 4, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 5, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 6, startMin: 10 * 60, endMin: 14 * 60 },
    ],
  },
];

const defaultRevenueSubscriptions: RevenueSubscriptionRecord[] = [
  {
    id: "sub_seed_jordan_starter",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "starter",
    status: "active",
    source: "seed",
    ownerLoId: "lo_jordan_lee",
    ownerEmail: "jordan.lee@loanapilot.ai",
    company: "Jordan Lee Lending",
    claimedZips: ["78701", "78702"],
    monthlyPriceCents: 2999,
    lifetimeMonths: 14,
  },
  {
    id: "sub_seed_priya_pro",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "pro",
    status: "active",
    source: "seed",
    ownerLoId: "lo_priya_nandakumar",
    ownerEmail: "priya.n@loanapilot.ai",
    company: "Nandakumar Capital",
    claimedZips: ["33131", "33132", "33133", "33134"],
    countyTerritories: ["Miami-Dade County, FL"],
    monthlyPriceCents: 9999,
    lifetimeMonths: 18,
  },
  {
    id: "sub_seed_mateo_elite",
    createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z",
    tier: "elite",
    status: "active",
    source: "seed",
    ownerLoId: "lo_mateo_rosales",
    ownerEmail: "mateo.r@loanapilot.ai",
    company: "Rosales Home Finance",
    claimedZips: ["85004", "85006", "85251", "85257", "85281", "85282"],
    countyTerritories: ["Maricopa County, AZ", "Pima County, AZ"],
    monthlyPriceCents: 29999,
    lifetimeMonths: 20,
  },
];

const emptyDb = (): DbShape => ({
  loanOfficers: defaultLoanOfficers,
  sessions: [],
  borrowerLeads: [],
  crmLeads: [],
  loAlerts: [],
  followUps: [],
  appointments: [],
  analyticsEvents: [],
  demoRequests: [],
  propertyEvaluations: [],
  revenueSubscriptions: defaultRevenueSubscriptions,
  chatSessions: [],
  websiteAutopilotChanges: [],
  autopilotRuns: [],
  paymentConversions: [],
  agentOnboarding: [],
  accounts: [],
  loginTokens: [],
  starterKits: [],
  officerProspects: [],
  cerebroActions: [],
  siteOverrides: [],
  siteOptimizer: {},
  consents: [],
  processedKeys: [],
  pushSubscriptions: [],
  crmConnections: [],
  crmDeliveries: [],
  freeUsage: [],
  marketingKits: [],
  zipScarcityEvents: [],
});

function describeFsError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Fill in any missing collections so older or partial snapshots stay forward-compatible. */
function normalize(snapshot: unknown): DbShape {
  const parsed = isPlainRecord(snapshot) ? snapshot : {};
  const loanOfficers = arrayOrEmpty<LoanOfficerRecord>(parsed.loanOfficers);
  const sessions = arrayOrEmpty<IntakeSessionRecord>(parsed.sessions);
  const revenueSubscriptions = arrayOrEmpty<RevenueSubscriptionRecord>(
    parsed.revenueSubscriptions,
  );

  return {
    loanOfficers: loanOfficers.length > 0 ? loanOfficers : defaultLoanOfficers,
    sessions: sessions.map((session) => ({
      ...session,
      status: session.status ?? "collecting",
    })),
    borrowerLeads: arrayOrEmpty<BorrowerLeadRecord>(parsed.borrowerLeads),
    crmLeads: arrayOrEmpty<CrmLeadRecord>(parsed.crmLeads),
    loAlerts: arrayOrEmpty<LoAlertRecord>(parsed.loAlerts),
    followUps: arrayOrEmpty<ScheduledFollowUpRecord>(parsed.followUps).map((followUp) => ({
      ...followUp,
      status: followUp.status === "sending" ? "pending" : followUp.status,
      attemptCount: followUp.attemptCount ?? 0,
    })),
    appointments: arrayOrEmpty<AppointmentRecord>(parsed.appointments),
    analyticsEvents: arrayOrEmpty<AnalyticsEventRecord>(parsed.analyticsEvents),
    demoRequests: arrayOrEmpty<DemoRequestRecord>(parsed.demoRequests),
    propertyEvaluations: arrayOrEmpty<PropertyEvaluationRecord>(parsed.propertyEvaluations),
    revenueSubscriptions:
      revenueSubscriptions.length > 0 ? revenueSubscriptions : defaultRevenueSubscriptions,
    chatSessions: arrayOrEmpty<ChatSessionRecord>(parsed.chatSessions).map((session) => ({
      ...session,
      capturedFields: isPlainRecord(session.capturedFields) ? session.capturedFields : {},
      messages: arrayOrEmpty(session.messages),
    })),
    websiteAutopilotChanges: arrayOrEmpty<WebsiteAutopilotChange>(parsed.websiteAutopilotChanges),
    autopilotRuns: arrayOrEmpty<AutopilotRunRecord>(parsed.autopilotRuns),
    paymentConversions: arrayOrEmpty<PaymentConversionRecord>(parsed.paymentConversions),
    agentOnboarding: arrayOrEmpty<AgentOnboardingRecord>(parsed.agentOnboarding),
    accounts: arrayOrEmpty<AccountRecord>(parsed.accounts),
    loginTokens: arrayOrEmpty<LoginTokenRecord>(parsed.loginTokens),
    starterKits: arrayOrEmpty<StarterKitRecord>(parsed.starterKits),
    officerProspects: arrayOrEmpty<OfficerProspectRecord>(parsed.officerProspects),
    cerebroActions: arrayOrEmpty<CerebroQueuedActionRecord>(parsed.cerebroActions),
    siteOverrides: arrayOrEmpty<SiteOverrideRecord>(parsed.siteOverrides),
    siteOptimizer: isPlainRecord(parsed.siteOptimizer) ? (parsed.siteOptimizer as SiteOptimizerState) : {},
    consents: arrayOrEmpty<ConsentRecord>(parsed.consents),
    processedKeys: arrayOrEmpty<ProcessedKeyRecord>(parsed.processedKeys),
    pushSubscriptions: arrayOrEmpty<PushSubscriptionRecord>(parsed.pushSubscriptions),
    crmConnections: arrayOrEmpty<CrmConnectionRecord>(parsed.crmConnections),
    crmDeliveries: arrayOrEmpty<CrmDeliveryRecord>(parsed.crmDeliveries),
    freeUsage: arrayOrEmpty<FreeUsageRecord>(parsed.freeUsage),
    zipScarcityEvents: arrayOrEmpty<ZipScarcityEventRecord>(parsed.zipScarcityEvents),
    marketingKits: arrayOrEmpty<MarketingKitRecord>(parsed.marketingKits).map((kit) => ({
      ...kit,
      linkedinArticles: arrayOrEmpty<LinkedInArticleRecord>(kit.linkedinArticles),
    })),
  };
}

/** Process-scoped source of truth. */
let memoryDb: DbShape | null = null;
let diskWritable = true;
let lastStorageError: string | undefined;

/**
 * Thrown by readDb() and writeDb() while the data file exists but could not be read
 * (a disk or permission error, or a corrupt file that could not be moved aside).
 *
 * The store is the system of record for paid ZIP codes, so it fails closed: answering from
 * an empty store would report every sold ZIP code as open, and the next write would replace
 * the real file with that empty store. Callers get an error instead, the file is left
 * untouched, and the read is tried again on a later call, so a passing fault clears itself.
 */
export class StoreUnavailableError extends Error {
  readonly code = "STORE_UNAVAILABLE";
  constructor(detail: string) {
    super(`The data store is temporarily unavailable: ${detail}`);
    this.name = "StoreUnavailableError";
  }
}

/** When the last read of an existing data file failed (ms since epoch), or null when the store is readable. */
let unreadableSince: number | null = null;
/** Why the last read failed. Kept apart from lastStorageError, which other storage steps reset. */
let unreadableReason: string | undefined;
let lastReadAttemptAt = 0;
/** A failed read is retried at most this often, so an outage doesn't re-read a large file on every request. */
const UNREADABLE_RETRY_MS = 1_000;

/** Size of the last snapshot written or loaded, in bytes (0 before the first one). */
let lastSnapshotBytes = 0;
/**
 * V8 cannot build a string longer than about 512 MB, and the snapshot is one JSON string, so
 * the store stops being able to save somewhere below that. Health reports headroom against it.
 */
const SNAPSHOT_HARD_LIMIT_BYTES = 512 * 1024 * 1024;
const SNAPSHOT_WARN_BYTES = 64 * 1024 * 1024;
const SNAPSHOT_CRITICAL_BYTES = 256 * 1024 * 1024;

/**
 * Stat of the data file as of the last time this process loaded or flushed
 * it. hydrate() compares against this on every call so it can notice a
 * sibling process's write (Hostinger can run more than one against the same
 * data file) without re-reading the file when nothing changed.
 */
let lastKnownStat: Stats | null = null;

/**
 * Nesting depth of writeDb() calls in this process. A mutator that itself
 * calls writeDb() (see the "nested writeDb" test) must reuse the outermost
 * call's cross-process lock instead of trying to acquire it again and
 * deadlocking on itself.
 */
let writeDbDepth = 0;

function statOrNull(target: string): Stats | null {
  try {
    return fs.statSync(/*turbopackIgnore: true*/ target);
  } catch {
    return null;
  }
}

function sameStat(a: Stats | null, b: Stats | null): boolean {
  if (a === null || b === null) return a === b;
  return a.mtimeMs === b.mtimeMs && a.size === b.size;
}

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ dataDir())) {
      fs.mkdirSync(/*turbopackIgnore: true*/ dataDir(), { recursive: true });
    }
    lastStorageError = undefined;
    return true;
  } catch (error) {
    lastStorageError = `Unable to create data directory: ${describeFsError(error)}`;
    console.error(`[db] ${lastStorageError}`, error);
    return false;
  }
}

/** How often the previous good snapshot is refreshed as `store.json.bak`. */
const BACKUP_MIN_INTERVAL_MS = 60_000;
let lastBackupAt = 0;

/**
 * Keeps one rolling copy of the last good snapshot next to the live file so a
 * bad write or a corrupted file can be recovered from (see loadFromDisk).
 * Throttled so a burst of small writes does not copy the file every time.
 * Best effort only: a failed copy must never block the real write.
 */
function rotateLastGoodSnapshot(target: string): void {
  const now = Date.now();
  if (now - lastBackupAt < BACKUP_MIN_INTERVAL_MS) return;
  try {
    if (!fs.existsSync(/*turbopackIgnore: true*/ target)) return;
    const bak = `${target}.bak`;
    const bakTmp = `${bak}.${process.pid}.tmp`;
    fs.copyFileSync(/*turbopackIgnore: true*/ target, bakTmp);
    fs.renameSync(/*turbopackIgnore: true*/ bakTmp, bak);
    lastBackupAt = now;
  } catch (error) {
    console.warn(`[db] Unable to refresh ${target}.bak: ${describeFsError(error)}`);
  }
}

/**
 * Writes the whole snapshot to disk: a temp file, fsync, then rename, so a crash or power loss
 * mid-write can't truncate or lose the snapshot (rename is atomic on the same filesystem; fsync
 * makes the new bytes durable before the swap). Throws when any step fails.
 */
function writeSnapshotFile(db: DbShape, target: string, tmp: string): void {
  const fd = fs.openSync(/*turbopackIgnore: true*/ tmp, "w");
  try {
    // Personal fields are encrypted on the way to disk when PII_ENCRYPTION_KEY is set
    // (see src/lib/crypto/pii-snapshot.ts); memory always holds plain values.
    // Compact JSON: the file is rewritten whole on every change, so indentation only
    // made each write bigger and slower. `jq . store.json` pretty-prints it for a person.
    const serialized = JSON.stringify(sealSnapshot(db));
    lastSnapshotBytes = Buffer.byteLength(serialized);
    fs.writeSync(fd, serialized);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  rotateLastGoodSnapshot(target);
  fs.renameSync(/*turbopackIgnore: true*/ tmp, target);
  lastStorageError = undefined;
  lastKnownStat = statOrNull(target);
}

function flushToDisk(db: DbShape): void {
  if (!diskWritable) return;
  if (!ensureDataDir()) {
    diskWritable = false;
    return;
  }
  const target = dbPath();
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    writeSnapshotFile(db, target, tmp);
  } catch (error) {
    // Disk unavailable or read-only: keep serving from memory. Stop retrying
    // so we don't throw on every request.
    diskWritable = false;
    lastStorageError = `Unable to persist data snapshot: ${describeFsError(error)}`;
    console.error(
      `[db] ${lastStorageError} — continuing from memory only; state will be lost on restart.`,
      error,
    );
    try {
      fs.rmSync(tmp, { force: true });
    } catch (cleanupError) {
      // Best effort only; persistence has already fallen back to memory.
      console.warn(`[db] Unable to remove temp snapshot ${tmp}: ${describeFsError(cleanupError)}`);
    }
  }
}

/** Reads and validates one snapshot file. Throws if it is missing, unreadable or not valid JSON. */
function readSnapshot(file: string, track = true): DbShape {
  const raw = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8");
  if (track) lastSnapshotBytes = Buffer.byteLength(raw);
  return normalize(openSnapshot(JSON.parse(raw) as unknown));
}

/**
 * Loads (or reloads) the in-memory store from disk, unconditionally.
 *
 * A snapshot that exists but cannot be parsed is never overwritten: it is moved
 * aside to `store.json.corrupt-<timestamp>` for manual recovery, and the store
 * is restored from the rolling `store.json.bak` when that is still valid.
 * Plain I/O errors (e.g. permissions), and a corrupt file that cannot be moved
 * aside, leave the file untouched and throw StoreUnavailableError: nothing is
 * served from an empty store and nothing is written until the file reads again.
 */
function loadFromDisk(): DbShape {
  let snapshotUnreadable = false;
  const file = dbPath();
  lastReadAttemptAt = Date.now();
  if (fs.existsSync(/*turbopackIgnore: true*/ file)) {
    try {
      memoryDb = readSnapshot(file);
      lastKnownStat = statOrNull(file);
      if (unreadableSince !== null) {
        console.error(`[db] Data snapshot at ${file} is readable again; resuming normal service.`);
        unreadableSince = null;
        unreadableReason = undefined;
        lastStorageError = undefined;
      }
      return memoryDb;
    } catch (error) {
      lastStorageError = `Unreadable data snapshot at ${file}: ${describeFsError(error)}`;
      console.error(`[db] ${lastStorageError}`, error);
      const isCorrupt = error instanceof SyntaxError;
      if (isCorrupt && diskWritable) {
        const quarantine = `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        try {
          fs.renameSync(/*turbopackIgnore: true*/ file, quarantine);
          console.error(`[db] Corrupt snapshot preserved as ${quarantine}.`);
          try {
            memoryDb = readSnapshot(`${file}.bak`);
            unreadableSince = null;
            unreadableReason = undefined;
            console.error(`[db] Restored the store from ${file}.bak (last good snapshot).`);
            flushToDisk(memoryDb);
            return memoryDb;
          } catch {
            console.error(`[db] No valid ${file}.bak to restore from; starting from an empty store.`);
          }
        } catch (renameError) {
          console.error(`[db] Unable to quarantine the corrupt snapshot: ${describeFsError(renameError)}`);
          snapshotUnreadable = true;
        }
      } else {
        snapshotUnreadable = true;
      }
      lastKnownStat = statOrNull(file);
    }
  }

  if (snapshotUnreadable) {
    // Fail closed. Keep no in-memory copy, so every later call tries the file again.
    memoryDb = null;
    unreadableSince ??= Date.now();
    unreadableReason = lastStorageError ?? "the data file could not be read";
    throw new StoreUnavailableError(unreadableReason);
  }

  unreadableSince = null;
  memoryDb = emptyDb();
  flushToDisk(memoryDb);
  return memoryDb;
}

/**
 * Hydrate the in-memory store from disk. Once loaded, a call costs a single
 * statSync: if the data file's mtime/size still match what we last loaded or
 * flushed, the in-memory copy is still current and is returned as-is; if they
 * differ, a sibling process (Hostinger can run more than one) has written
 * since, and we reload.
 */
function hydrate(): DbShape {
  if (!memoryDb) {
    if (unreadableSince !== null && Date.now() - lastReadAttemptAt < UNREADABLE_RETRY_MS) {
      throw new StoreUnavailableError(unreadableReason ?? "the data file could not be read");
    }
    return loadFromDisk();
  }
  if (sameStat(statOrNull(dbPath()), lastKnownStat)) return memoryDb;
  return loadFromDisk();
}

/**
 * A read-only copy of the store whose collections are cloned one at a time, on first use.
 *
 * Callers still get isolated copies (they cannot mutate live state), but a caller that only
 * needs `revenueSubscriptions` no longer pays to copy every lead and chat transcript too. A
 * ZIP code check used to deep-clone the whole store; it now clones one collection. Each
 * collection is copied when it is first read, so use the result right away rather than
 * holding it across later writes (every caller already does).
 */
function lazySnapshot(live: DbShape): DbShape {
  const view = {} as DbShape;
  for (const key of Object.keys(live) as Array<keyof DbShape>) {
    Object.defineProperty(view, key, {
      enumerable: true,
      configurable: true,
      get() {
        const copy = structuredClone(live[key]);
        Object.defineProperty(view, key, { value: copy, enumerable: true, configurable: true, writable: true });
        return copy;
      },
      set(next) {
        Object.defineProperty(view, key, { value: next, enumerable: true, configurable: true, writable: true });
      },
    });
  }
  return view;
}

export function ensureDataDirExists(): void {
  ensureDataDir();
}

export function readDb(): DbShape {
  // Copies, never the live objects, so callers cannot accidentally mutate live state.
  return lazySnapshot(hydrate());
}

const LOCK_STALE_MS = 10_000;
const LOCK_MAX_WAIT_MS = 5_000;
const LOCK_RETRY_MS = 25;

function lockPath(): string {
  return `${dbPath()}.lock`;
}

/**
 * Synchronous sleep via Atomics.wait on a throwaway SharedArrayBuffer. Node
 * (unlike a browser's UI thread) allows blocking the main thread this way;
 * blocking is the point here — we hold no lock yet, so nothing else in this
 * process is waiting on us.
 */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tryCreateLock(path: string): boolean {
  try {
    fs.closeSync(fs.openSync(/*turbopackIgnore: true*/ path, "wx"));
    return true;
  } catch {
    return false;
  }
}

/**
 * A lock file older than LOCK_STALE_MS is assumed abandoned by a process that
 * died (or was killed) before releasing it, and is removed so a live writer
 * doesn't wait out the full retry window for a lock nobody holds anymore.
 */
function breakStaleLock(path: string): void {
  const stat = statOrNull(path);
  if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
    fs.rmSync(/*turbopackIgnore: true*/ path, { force: true });
  }
}

function releaseLock(path: string): void {
  try {
    fs.rmSync(/*turbopackIgnore: true*/ path, { force: true });
  } catch (error) {
    console.error(`[db] Unable to release write lock ${path}: ${describeFsError(error)}`, error);
  }
}

/**
 * Acquire an exclusive, cross-process lock on the data file before a
 * read-modify-write, so two Node processes sharing one data file (Hostinger
 * can run more than one) can't both flush in between each other's read and
 * silently drop one side's write. `fs.openSync(path, "wx")` is the
 * mutual-exclusion primitive — it fails if the lock file already exists — and
 * a loser retries with short synchronous sleeps for up to ~5s, breaking any
 * stale lock it finds along the way. If the lock still can't be acquired we
 * log and proceed unlocked: losing the caller's write is worse than the rare
 * unlocked write this falls back to.
 */
function acquireLock(): () => void {
  const path = lockPath();
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;

  do {
    if (tryCreateLock(path)) return () => releaseLock(path);
    breakStaleLock(path);
    sleepSync(LOCK_RETRY_MS);
  } while (Date.now() < deadline);

  console.error(
    `[db] Timed out after ${LOCK_MAX_WAIT_MS}ms waiting for write lock ${path}; proceeding without it rather than drop the write.`,
  );
  return () => {};
}

/**
 * Mutate the live in-memory store, then best-effort flush to disk.
 *
 * The mutator receives the process-scoped store (not a disposable clone).
 * Clone-then-replace RMW lets overlapping or nested writers drop each other's
 * updates (e.g. two demo-request reservations racing on the same ZIP).
 *
 * When disk is writable, the whole read-modify-write runs under an exclusive
 * cross-process lock (acquireLock) so a sibling process on the same host
 * can't flush in between our read and our write and get silently clobbered.
 * `writeDbDepth` makes this reentrant: a mutator that itself calls writeDb()
 * reuses the outermost call's lock instead of trying to acquire it twice
 * (which would otherwise deadlock this process against itself).
 */
export function writeDb(mutator: (db: DbShape) => void): DbShape {
  const shouldLock = writeDbDepth === 0 && diskWritable && ensureDataDir();
  const release = shouldLock ? acquireLock() : null;
  writeDbDepth += 1;
  try {
    const db = hydrate();
    mutator(db);
    flushToDisk(db);
    return lazySnapshot(db);
  } finally {
    writeDbDepth -= 1;
    release?.();
  }
}

/** Thrown by writeDbDurably() when the snapshot did not reach the disk. Memory already holds the change. */
export class StoreNotDurableError extends Error {
  readonly code = "STORE_NOT_DURABLE";
  constructor(detail: string, options?: { cause?: unknown }) {
    super(`The data file was not written to disk: ${detail}`, options);
    this.name = "StoreNotDurableError";
  }
}

/**
 * writeDb() for callers that must know the change is on disk: the copy of a payment that
 * PostgreSQL already decided, and a hand-over back to the data file. Unlike writeDb() it never
 * reports success for a write that stayed in memory: it tries the disk even after an earlier
 * failure, and throws StoreNotDurableError when the snapshot could not be written.
 *
 * It does not change what writeDb() does: a failure here leaves writeDb()'s own state alone.
 */
export function writeDbDurably(mutator: (db: DbShape) => void): DbShape {
  const dirReady = ensureDataDir();
  const release = writeDbDepth === 0 && dirReady ? acquireLock() : null;
  writeDbDepth += 1;
  try {
    const db = hydrate();
    mutator(db);
    if (!dirReady) throw new StoreNotDurableError("the data folder is not available");
    const target = dbPath();
    const tmp = `${target}.${process.pid}.tmp`;
    try {
      writeSnapshotFile(db, target, tmp);
    } catch (error) {
      try {
        fs.rmSync(/*turbopackIgnore: true*/ tmp, { force: true });
      } catch {
        // Best effort only.
      }
      throw new StoreNotDurableError(describeFsError(error), { cause: error });
    }
    return lazySnapshot(db);
  } finally {
    writeDbDepth -= 1;
    release?.();
  }
}

export function persistSession(session: IntakeSessionRecord): void {
  writeDb((db) => {
    const idx = db.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) db.sessions[idx] = session;
    else db.sessions.push(session);
  });
}

export function appendBorrowerLead(lead: BorrowerLeadRecord): void {
  writeDb((db) => db.borrowerLeads.push(lead));
}

export function appendCrmLead(record: CrmLeadRecord): void {
  writeDb((db) => db.crmLeads.push(record));
}

export function appendLoAlert(record: LoAlertRecord): void {
  writeDb((db) => db.loAlerts.push(record));
}

export function appendFollowUp(record: ScheduledFollowUpRecord): void {
  writeDb((db) => db.followUps.push(record));
}

export function persistFollowUpsBatch(batch: ScheduledFollowUpRecord[]): void {
  writeDb((db) => {
    batch.forEach((followUp) => db.followUps.push(followUp));
  });
}

export function appendAppointment(record: AppointmentRecord): void {
  writeDb((db) => db.appointments.push(record));
}

/** Appends one note to a CRM lead's mirrored notes. Returns false if no CRM lead exists for that borrower. */
export function appendCrmNote(borrowerLeadId: string, note: string): boolean {
  let found = false;
  writeDb((db) => {
    const crm = db.crmLeads.find((item) => item.borrowerLeadId === borrowerLeadId);
    if (!crm) return;
    crm.notes.push(note);
    found = true;
  });
  return found;
}

/** Marks every still-pending follow-up for a lead as cancelled. Returns the number cancelled. */
export function cancelPendingFollowUps(borrowerLeadId: string): number {
  let cancelled = 0;
  writeDb((db) => {
    db.followUps.forEach((job) => {
      if (job.borrowerLeadId === borrowerLeadId && job.status === "pending") {
        job.status = "cancelled";
        cancelled += 1;
      }
    });
  });
  return cancelled;
}

export function readChatSession(id: string): ChatSessionRecord | null {
  return readDb().chatSessions.find((session) => session.id === id) ?? null;
}

/** Upserts by id — mirrors persistSession's replace-or-append pattern. */
export function saveChatSession(session: ChatSessionRecord): void {
  writeDb((db) => {
    const idx = db.chatSessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) db.chatSessions[idx] = session;
    else db.chatSessions.push(session);
  });
}

/**
 * Keyed by stripeSubscriptionId, not stripeCustomerId — one customer can hold more than
 * one subscription over time, and a customer-only lookup would let a delete event for a
 * stale/replaced subscription cancel the customer's current one.
 */
export function findRevenueSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string,
): RevenueSubscriptionRecord | null {
  return (
    readDb().revenueSubscriptions.find(
      (subscription) => subscription.stripeSubscriptionId === stripeSubscriptionId,
    ) ?? null
  );
}

/** Upserts by id — mirrors saveChatSession's replace-or-append pattern. */
export function saveRevenueSubscription(subscription: RevenueSubscriptionRecord): void {
  writeDb((db) => {
    const idx = db.revenueSubscriptions.findIndex((s) => s.id === subscription.id);
    if (idx >= 0) db.revenueSubscriptions[idx] = subscription;
    else db.revenueSubscriptions.push(subscription);
  });
}

/** saveRevenueSubscription() through writeDbDurably(): throws StoreNotDurableError when the disk did not take it. */
export function saveRevenueSubscriptionDurably(subscription: RevenueSubscriptionRecord): void {
  writeDbDurably((db) => {
    const idx = db.revenueSubscriptions.findIndex((s) => s.id === subscription.id);
    if (idx >= 0) db.revenueSubscriptions[idx] = subscription;
    else db.revenueSubscriptions.push(subscription);
  });
}

/** Writes the current store to disk now. Throws StoreNotDurableError when it cannot. */
export function flushDbDurably(): void {
  writeDbDurably(() => undefined);
}

/**
 * Upserts a subscription and, if a valid zip is given, locks it into that
 * subscription's claimedZips in the same writeDb transaction as the upsert —
 * so two overlapping fulfillment events for different subscriptions can never
 * both claim the same zip. If another active/trialing subscription belonging
 * to a *different* customer already holds the zip, the upsert still proceeds
 * (payment already succeeded) but the zip is left unclaimed and `zipConflict`
 * comes back true for the caller to log. A subscription belonging to the same
 * customer (e.g. a replacement created before Stripe's delete event for the
 * old one arrives) is never treated as a conflict — that's an idempotent
 * territory transfer, not a competing claim.
 *
 * `zipNewlyLocked` is true only for a genuine open -> claimed transition: this call claimed
 * the zip AND no live subscription (this one's stored copy or the same customer's other one)
 * held it beforehand. A same-customer transfer or replacement claims the zip for the new
 * record but leaves `zipNewlyLocked` false, because the territory was already taken.
 */
export function saveRevenueSubscriptionWithZipClaim(
  subscription: RevenueSubscriptionRecord,
  zip: string | null,
): { record: RevenueSubscriptionRecord; zipClaimed: boolean; zipConflict: boolean; zipNewlyLocked: boolean } {
  let result!: { record: RevenueSubscriptionRecord; zipClaimed: boolean; zipConflict: boolean; zipNewlyLocked: boolean };
  writeDb((db) => {
    const zipConflict =
      zip !== null &&
      db.revenueSubscriptions.some(
        (s) =>
          s.id !== subscription.id &&
          // Not a bare stripeCustomerId comparison: two plans with no Stripe customer
          // (admin adjustments) would compare equal and could both lock one ZIP code.
          claimHolderKey(s) !== claimHolderKey(subscription) &&
          isLiveSubscription(s) &&
          s.claimedZips.includes(zip),
      );
    const zipClaimed = zip !== null && !zipConflict && !subscription.claimedZips.includes(zip);
    // Read before the upsert below: was the zip already held by any live subscription?
    const alreadyHeld = zip !== null && db.revenueSubscriptions.some((s) => isLiveSubscription(s) && s.claimedZips.includes(zip));
    const zipNewlyLocked = zipClaimed && !alreadyHeld;
    // On conflict, also strip the contested zip from *this* record's own claimedZips —
    // it may already be there from a stale prior state (e.g. this subscription was
    // reactivated and its old claimedZips array was never cleared), which would
    // otherwise leave two active/trialing subscriptions both listing the same zip.
    const record: RevenueSubscriptionRecord = zipClaimed
      ? { ...subscription, claimedZips: [...subscription.claimedZips, zip] }
      : zipConflict
        ? { ...subscription, claimedZips: subscription.claimedZips.filter((claimed) => claimed !== zip) }
        : subscription;

    const idx = db.revenueSubscriptions.findIndex((s) => s.id === record.id);
    if (idx >= 0) db.revenueSubscriptions[idx] = record;
    else db.revenueSubscriptions.push(record);

    result = { record, zipClaimed, zipConflict, zipNewlyLocked };
  });
  return result;
}

export function listWebsiteAutopilotChanges(userId?: string): WebsiteAutopilotChange[] {
  const all = readDb().websiteAutopilotChanges;
  return userId ? all.filter((change) => change.userId === userId) : all;
}

/** Upserts by id — mirrors saveChatSession's replace-or-append pattern. */
export function saveWebsiteAutopilotChange(change: WebsiteAutopilotChange): void {
  writeDb((db) => {
    const idx = db.websiteAutopilotChanges.findIndex((c) => c.id === change.id);
    if (idx >= 0) db.websiteAutopilotChanges[idx] = change;
    else db.websiteAutopilotChanges.push(change);
  });
}

/** Newest first — this is a history log, so recency order is what the UI wants. */
export function listAutopilotRuns(userId?: string): AutopilotRunRecord[] {
  const all = readDb().autopilotRuns;
  const scoped = userId ? all.filter((run) => run.userId === userId) : all;
  return [...scoped].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Keep each user's run history bounded so repeated dry-run previews can't grow the store forever. */
const MAX_AUTOPILOT_RUNS_PER_USER = 100;

/** Upserts by id — mirrors saveWebsiteAutopilotChange's replace-or-append pattern. */
export function saveAutopilotRun(run: AutopilotRunRecord): void {
  writeDb((db) => {
    const idx = db.autopilotRuns.findIndex((r) => r.id === run.id);
    if (idx >= 0) {
      db.autopilotRuns[idx] = run;
      return;
    }
    db.autopilotRuns.push(run);
    if (!run.userId) return;
    const forUser = db.autopilotRuns.filter((r) => r.userId === run.userId);
    if (forUser.length <= MAX_AUTOPILOT_RUNS_PER_USER) return;
    const oldestId = [...forUser].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id;
    if (oldestId) {
      db.autopilotRuns = db.autopilotRuns.filter((r) => r.id !== oldestId);
    }
  });
}

export function readAgentOnboarding(userId: string): AgentOnboardingRecord | null {
  return readDb().agentOnboarding.find((record) => record.userId === userId) ?? null;
}

/**
 * Saves the onboarding record. `officerPhoto` is owned by setOfficerPhoto: the stored value
 * is always kept here, so a save racing a photo upload can't drop or forge it.
 */
export function saveAgentOnboarding(record: AgentOnboardingRecord): void {
  writeDb((db) => {
    const idx = db.agentOnboarding.findIndex((item) => item.userId === record.userId);
    const { officerPhoto: _ignored, ...rest } = record;
    void _ignored;
    if (idx >= 0) {
      const storedPhoto = db.agentOnboarding[idx].officerPhoto;
      db.agentOnboarding[idx] = { ...rest, ...(storedPhoto ? { officerPhoto: storedPhoto } : {}) };
    } else db.agentOnboarding.push(rest);
  });
}

/**
 * Records (or clears, with null) the officer's headshot metadata, creating a draft
 * onboarding record from `draft` when the officer has none yet. Atomic inside writeDb.
 */
export function setOfficerPhoto(
  userId: string,
  photo: AgentOnboardingRecord["officerPhoto"] | null,
  draft: () => AgentOnboardingRecord,
): AgentOnboardingRecord {
  let saved: AgentOnboardingRecord | undefined;
  writeDb((db) => {
    let record = db.agentOnboarding.find((item) => item.userId === userId);
    if (!record) {
      record = draft();
      db.agentOnboarding.push(record);
    }
    if (photo) record.officerPhoto = photo;
    else delete record.officerPhoto;
    record.updatedAt = new Date().toISOString();
    saved = structuredClone(record);
  });
  if (!saved) throw new Error("Officer photo was not saved.");
  return saved;
}

export function appendDemoRequest(record: DemoRequestRecord): void {
  writeDb((db) => db.demoRequests.push(record));
}

/** How long after the first submit the optional follow-up details can still be added. */
export const DEMO_REQUEST_DETAILS_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Adds the optional second-step details (company, team size, role) to an inquiry saved
 * moments ago. Only fills fields that are still empty, and only inside the window above,
 * so a leaked id can't be used to rewrite an older lead. Returns the record and whether
 * anything was filled in, or null when the inquiry is unknown or too old.
 */
export function addDemoRequestDetails(
  id: string,
  details: Pick<DemoRequestRecord, "company" | "monthlyLeadVolume" | "role">,
  now: Date = new Date(),
): { record: DemoRequestRecord; changed: boolean } | null {
  let result: { record: DemoRequestRecord; changed: boolean } | null = null;
  writeDb((db) => {
    const record = db.demoRequests.find((item) => item.id === id);
    if (!record) return;
    const age = now.getTime() - new Date(record.createdAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > DEMO_REQUEST_DETAILS_WINDOW_MS) return;
    let changed = false;
    if (details.company && !record.company) { record.company = details.company; changed = true; }
    if (details.monthlyLeadVolume && !record.monthlyLeadVolume) { record.monthlyLeadVolume = details.monthlyLeadVolume; changed = true; }
    if (details.role && !record.role) { record.role = details.role; changed = true; }
    result = { record: structuredClone(record), changed };
  });
  return result;
}

export function appendPropertyEvaluation(record: PropertyEvaluationRecord): void {
  writeDb((db) => db.propertyEvaluations.push(record));
}

/** Keep the analytics log bounded so it can't grow (and slow disk writes) forever. */
const MAX_ANALYTICS_EVENTS = 2000;

export function appendAnalytics(event: Omit<AnalyticsEventRecord, "id" | "createdAt">): void {
  writeDb((db) => {
    db.analyticsEvents.push({
      ...event,
      id: `evt_${Date.now()}_${db.analyticsEvents.length}`,
      createdAt: new Date().toISOString(),
    });
    if (db.analyticsEvents.length > MAX_ANALYTICS_EVENTS) {
      db.analyticsEvents.splice(0, db.analyticsEvents.length - MAX_ANALYTICS_EVENTS);
    }
  });
}

export type StorageHeadroom = "ok" | "warn" | "critical";

/** Exposed for diagnostics/health checks. Never throws: an unreadable store is reported, not raised. */
export function storageMode(): {
  persistent: boolean;
  dir: string;
  error?: string;
  /** True while the data file exists but cannot be read; reads and writes are refused until it can. */
  unavailable: boolean;
  /** Size of the data file as last written or loaded. */
  sizeBytes: number;
  /** How close the single-file store is to the size at which it can no longer be saved. */
  headroom: StorageHeadroom;
} {
  let unavailable = false;
  try {
    hydrate();
  } catch (error) {
    if (!(error instanceof StoreUnavailableError)) throw error;
    unavailable = true;
  }
  const headroom: StorageHeadroom =
    lastSnapshotBytes >= SNAPSHOT_CRITICAL_BYTES ? "critical" : lastSnapshotBytes >= SNAPSHOT_WARN_BYTES ? "warn" : "ok";
  return {
    persistent: diskWritable && !unavailable,
    dir: dataDir(),
    error: unavailable ? unreadableReason : lastStorageError,
    unavailable,
    sizeBytes: lastSnapshotBytes,
    headroom,
  };
}

/** The size above which the store can no longer be written, for tests and diagnostics. */
export const SNAPSHOT_LIMITS = {
  warnBytes: SNAPSHOT_WARN_BYTES,
  criticalBytes: SNAPSHOT_CRITICAL_BYTES,
  hardLimitBytes: SNAPSHOT_HARD_LIMIT_BYTES,
} as const;

/**
 * Appends a verified payment unless this invoice or Stripe event was already
 * recorded. Atomic inside writeDb, so a redelivered webhook can never double count.
 */
export function recordPaymentConversion(record: PaymentConversionRecord): { recorded: boolean; reason?: string; firstForCustomer?: boolean } {
  let outcome: { recorded: boolean; reason?: string; firstForCustomer?: boolean } = { recorded: false };
  writeDb((db) => {
    if (db.paymentConversions.some((item) => item.id === record.id || item.eventId === record.eventId)) {
      outcome = { recorded: false, reason: "Payment already recorded (duplicate delivery)." };
      return;
    }
    const firstForCustomer = !db.paymentConversions.some((item) => item.stripeCustomerId === record.stripeCustomerId);
    db.paymentConversions.push(record);
    outcome = { recorded: true, firstForCustomer };
  });
  return outcome;
}

/** Neighbor-lock alerts kept on the single-file store; the oldest drop off first. */
const MAX_ZIP_SCARCITY_EVENTS = 500;

/**
 * Appends a neighbor-lock alert unless one already exists for this ZIP code and owner, so a
 * redelivered webhook never writes the alert twice. Atomic inside writeDb.
 */
export function recordZipScarcityEvent(record: ZipScarcityEventRecord): { recorded: boolean } {
  let recorded = false;
  writeDb((db) => {
    if (db.zipScarcityEvents.some((item) => item.lockedZip === record.lockedZip && item.ownerRef === record.ownerRef)) return;
    db.zipScarcityEvents.push(record);
    if (db.zipScarcityEvents.length > MAX_ZIP_SCARCITY_EVENTS) {
      db.zipScarcityEvents.splice(0, db.zipScarcityEvents.length - MAX_ZIP_SCARCITY_EVENTS);
    }
    recorded = true;
  });
  return { recorded };
}

/** Newest first. */
export function listZipScarcityEvents(limit = 50): ZipScarcityEventRecord[] {
  return [...readDb().zipScarcityEvents].reverse().slice(0, Math.max(1, limit));
}

/** Keeps the Cerebro collections bounded on the single-file store. */
const MAX_STARTER_KITS = 2000;
const MAX_OFFICER_PROSPECTS = 5000;
const MAX_CEREBRO_ACTIONS = 5000;

export function saveStarterKit(kit: StarterKitRecord): void {
  writeDb((db) => {
    db.starterKits.push(kit);
    if (db.starterKits.length > MAX_STARTER_KITS) db.starterKits.splice(0, db.starterKits.length - MAX_STARTER_KITS);
  });
}

export function readStarterKit(id: string): StarterKitRecord | null {
  return readDb().starterKits.find((kit) => kit.id === id) ?? null;
}

/** One prospect per chat session: later calls in the same chat update it instead of adding another. */
export function upsertOfficerProspect(prospect: OfficerProspectRecord): OfficerProspectRecord {
  let saved = prospect;
  writeDb((db) => {
    const idx = db.officerProspects.findIndex((item) => item.sessionId === prospect.sessionId);
    if (idx >= 0) {
      saved = { ...db.officerProspects[idx], ...prospect, id: db.officerProspects[idx].id, createdAt: db.officerProspects[idx].createdAt };
      db.officerProspects[idx] = saved;
    } else {
      db.officerProspects.push(prospect);
      if (db.officerProspects.length > MAX_OFFICER_PROSPECTS) {
        db.officerProspects.splice(0, db.officerProspects.length - MAX_OFFICER_PROSPECTS);
      }
    }
  });
  return saved;
}

export function saveCerebroAction(action: CerebroQueuedActionRecord): void {
  writeDb((db) => {
    const idx = db.cerebroActions.findIndex((item) => item.id === action.id);
    if (idx >= 0) db.cerebroActions[idx] = action;
    else db.cerebroActions.push(action);
    if (db.cerebroActions.length > MAX_CEREBRO_ACTIONS) db.cerebroActions.splice(0, db.cerebroActions.length - MAX_CEREBRO_ACTIONS);
  });
}

export function listCerebroActions(loId: string): CerebroQueuedActionRecord[] {
  return readDb().cerebroActions.filter((action) => action.loId === loId);
}

export function saveSiteOverride(record: SiteOverrideRecord): void {
  writeDb((db) => {
    const idx = db.siteOverrides.findIndex((item) => item.id === record.id);
    if (idx >= 0) db.siteOverrides[idx] = record;
    else db.siteOverrides.push(record);
    if (db.siteOverrides.length > 3000) db.siteOverrides.splice(0, db.siteOverrides.length - 3000);
  });
}

/** The live override for one page field, newest first, or null. */
export function liveSiteOverride(pathname: string, field: SiteOverrideRecord["field"]): SiteOverrideRecord | null {
  const matches = readDb().siteOverrides.filter((item) => item.path === pathname && item.field === field && item.status === "live");
  return matches.length ? matches[matches.length - 1] : null;
}

export function saveSiteOptimizerState(state: SiteOptimizerState): void {
  writeDb((db) => {
    db.siteOptimizer = { ...db.siteOptimizer, ...state };
  });
}

/** Keeps the free-usage ledger to the last few days (it only answers "how much today?"). */
const FREE_USAGE_KEEP_DAYS = 3;

/** Gives back a free-plan action that produced no finished work (the tool failed or asked for a fix). */
export function releaseFreeAction(userId: string, day: string): void {
  writeDb((db) => {
    const row = db.freeUsage.find((entry) => entry.userId === userId && entry.day === day);
    if (row && row.actions > 0) row.actions -= 1;
  });
}

/** Free-plan actions this account has used on `day` (UTC, YYYY-MM-DD). */
export function freeActionsUsed(userId: string, day: string): number {
  return readDb().freeUsage.find((row) => row.userId === userId && row.day === day)?.actions ?? 0;
}

/**
 * Atomically uses one free-plan action for `day` if fewer than `limit` were used.
 * Returns true when the action may run.
 */
export function consumeFreeAction(userId: string, day: string, limit: number): boolean {
  let allowed = false;
  writeDb((db) => {
    const cutoff = new Date(Date.parse(`${day}T00:00:00Z`) - FREE_USAGE_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
    db.freeUsage = db.freeUsage.filter((row) => row.day > cutoff);
    let row = db.freeUsage.find((entry) => entry.userId === userId && entry.day === day);
    if (!row) {
      row = { userId, day, actions: 0 };
      db.freeUsage.push(row);
    }
    if (row.actions < limit) {
      row.actions += 1;
      allowed = true;
    }
  });
  return allowed;
}

// ---------------------------------------------------------------------------
// Marketing kit: website badge sightings and LinkedIn article drafts
// ---------------------------------------------------------------------------

export function readMarketingKit(userId: string): MarketingKitRecord | null {
  return readDb().marketingKits.find((kit) => kit.userId === userId) ?? null;
}

const BADGE_TOUCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Notes that the officer's badge was seen on an outside website. Writes at most once a day
 * per officer (the first sighting, a new host, or a day-old last-seen time), so a busy
 * website showing the badge doesn't turn every image request into a disk write.
 */
export function recordBadgeSeen(userId: string, host: string, now = new Date()): void {
  const existing = readMarketingKit(userId);
  if (
    existing?.badgeHost === host &&
    existing.badgeLastSeenAt &&
    now.getTime() - Date.parse(existing.badgeLastSeenAt) < BADGE_TOUCH_INTERVAL_MS
  ) {
    return;
  }
  writeDb((db) => {
    let kit = db.marketingKits.find((item) => item.userId === userId);
    if (!kit) {
      kit = { userId, linkedinArticles: [] };
      db.marketingKits.push(kit);
    }
    const iso = now.toISOString();
    if (!kit.badgeHost) {
      kit.badgeHost = host;
      kit.badgeFirstSeenAt = iso;
    }
    kit.badgeLastSeenAt = iso;
  });
}

/**
 * Saves a LinkedIn article draft if the officer still has one left. `allowed` decides from
 * the officer's existing articles (checked inside the write lock, so two clicks at once
 * can't both get through). Returns false when the quota is used up.
 */
export function saveLinkedInArticle(
  userId: string,
  article: LinkedInArticleRecord,
  allowed: (existing: LinkedInArticleRecord[]) => boolean,
): boolean {
  let saved = false;
  writeDb((db) => {
    let kit = db.marketingKits.find((item) => item.userId === userId);
    if (!kit) {
      kit = { userId, linkedinArticles: [] };
      db.marketingKits.push(kit);
    }
    if (!allowed(kit.linkedinArticles)) return;
    kit.linkedinArticles.push(article);
    saved = true;
  });
  return saved;
}
