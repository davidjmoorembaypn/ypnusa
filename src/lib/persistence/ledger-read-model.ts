import type { StoreMode } from "./mode";

/**
 * In-memory answer to "which ZIP codes are held by a paid plan?", so the many places that ask can
 * stay synchronous while the ledger moves to PostgreSQL.
 *
 *   json      The data file's answer, every time. This is also the state before anything is configured.
 *   shadow    The data file's answer; PostgreSQL's is compared with it in the background.
 *   postgres  PostgreSQL's last loaded answer. It is reloaded after every write this process
 *             makes and whenever it is older than `refreshAfterMs`. If there is none, or it is
 *             older than `maxStaleMs`, the data file answers instead.
 *
 * A stale "open" can only last `refreshAfterMs` and never sells a ZIP code twice: the claim
 * itself is decided inside one database transaction, not from this copy.
 */
export interface LedgerReadModelSource {
  mode: StoreMode;
  /** Loads the paid ledger from PostgreSQL. */
  load: () => Promise<Set<string>>;
  /** Shadow mode: called (throttled) with the data file's answer so the two can be compared. */
  compare?: (dataFileAnswer: Set<string>) => void;
  refreshAfterMs?: number;
  maxStaleMs?: number;
  compareEveryMs?: number;
  now?: () => number;
}

interface ReadModelState {
  source: LedgerReadModelSource | null;
  snapshot: { zips: Set<string>; loadedAt: number } | null;
  refreshing: Promise<void> | null;
  lastCompareAt: number;
  fallbacks: number;
  refreshFailures: number;
}

// Shared across every copy of this module the server may load (route bundles, instrumentation).
const KEY = Symbol.for("ypnusa.ledgerReadModel");
const holder = globalThis as unknown as Record<symbol, ReadModelState | undefined>;
const state: ReadModelState = (holder[KEY] ??= {
  source: null,
  snapshot: null,
  refreshing: null,
  lastCompareAt: 0,
  fallbacks: 0,
  refreshFailures: 0,
});

export function configureLedgerReadModel(source: LedgerReadModelSource | null): void {
  state.source = source;
  state.snapshot = null;
  state.refreshing = null;
  state.lastCompareAt = 0;
  state.fallbacks = 0;
  state.refreshFailures = 0;
}

/** Loads PostgreSQL's ledger now. Resolves false (and keeps the previous copy) when it cannot. */
export function refreshLedgerReadModel(): Promise<boolean> {
  const source = state.source;
  if (!source || source.mode !== "postgres") return Promise.resolve(false);
  const now = source.now ?? Date.now;
  state.refreshing ??= source
    .load()
    .then((zips) => {
      if (state.source === source) state.snapshot = { zips, loadedAt: now() };
    })
    .catch(() => {
      state.refreshFailures += 1;
    })
    .finally(() => {
      state.refreshing = null;
    });
  const before = state.snapshot;
  return state.refreshing.then(() => state.snapshot !== before && state.snapshot !== null);
}

export function paidLedgerSnapshot(fromDataFile: () => Set<string>): Set<string> {
  const source = state.source;
  if (!source || source.mode === "json") return fromDataFile();
  const now = (source.now ?? Date.now)();

  if (source.mode === "shadow") {
    const answer = fromDataFile();
    if (source.compare && now - state.lastCompareAt >= (source.compareEveryMs ?? 60_000)) {
      state.lastCompareAt = now;
      source.compare(answer);
    }
    return answer;
  }

  const age = state.snapshot ? now - state.snapshot.loadedAt : Number.POSITIVE_INFINITY;
  if (age > (source.refreshAfterMs ?? 10_000)) void refreshLedgerReadModel();
  if (state.snapshot && age <= (source.maxStaleMs ?? 120_000)) return new Set(state.snapshot.zips);
  state.fallbacks += 1;
  return fromDataFile();
}

export function ledgerReadModelStatus(): { mode: StoreMode; loaded: boolean; fallbacks: number; refreshFailures: number } {
  return {
    mode: state.source?.mode ?? "json",
    loaded: state.snapshot !== null,
    fallbacks: state.fallbacks,
    refreshFailures: state.refreshFailures,
  };
}
