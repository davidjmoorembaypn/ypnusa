import { readPersistenceAuthorityNote, writePersistenceAuthorityNote } from "@/lib/db";
import { configureLedgerReadModel } from "@/lib/persistence/ledger-read-model";
import { resolvePersistenceModes } from "@/lib/persistence/mode";
import { createPgClient, databaseSettings } from "@/lib/persistence/sql-client";
import { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } from "./json-repositories";
import { Persistence, type Authority, type AuthorityMarker, type PersistenceStatus } from "./persistence";
import type { SubscriptionRepository, TerritoryLedgerRepository } from "./types";

export type { SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";
export type { ParityReport, PersistenceStatus, SyncReport } from "./persistence";
export type { SaveOptions } from "./types";
export { StaleWriteError } from "./subscription-record";
export { onePlanAtATime, retryStaleWrites } from "./plan-lock";

/**
 * The one place the app gets its repositories from. Which store sits behind them comes from the
 * server settings (DATABASE_URL, YPN_LEDGER_STORE, YPN_SUBSCRIPTION_STORE); with none of them
 * set, this is the data file exactly as before.
 */

// One instance per process, even when the server loads this module more than once
// (each route bundle and the start-up hook can get their own copy).
const KEY = Symbol.for("ypnusa.persistence");
const holder = globalThis as unknown as Record<symbol, Persistence | undefined>;

/** The note beside the data file, read once and then kept in memory (this process is its only writer). */
function fileAuthorityMarker(): AuthorityMarker {
  let value: Authority | null = null;
  return {
    read: () => (value ??= readPersistenceAuthorityNote()),
    write: (next) => {
      writePersistenceAuthorityNote(next);
      value = next;
    },
  };
}

function build(): Persistence {
  const modes = resolvePersistenceModes();
  for (const warning of modes.warnings) console.warn(`[persistence] ${warning}`);
  const settings = databaseSettings();
  return new Persistence({
    modes,
    json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
    connect: settings ? () => createPgClient(settings) : null,
    authorityMarker: fileAuthorityMarker(),
  }).activate();
}

export function persistence(): Persistence {
  return (holder[KEY] ??= build());
}

export function subscriptionRepository(): SubscriptionRepository {
  return persistence().subscriptions;
}

export function territoryLedger(): TerritoryLedgerRepository {
  return persistence().ledger;
}

export function persistenceStatus(): PersistenceStatus {
  return persistence().status();
}

/**
 * Called once when the server starts. Connects and brings the stores in line in the background:
 * a database that is slow or down must never delay the site coming up.
 */
export function startPersistence(): void {
  void persistence().start();
}

/** Replaces the process-wide instance. Tests only. */
export async function replacePersistenceForTests(next: Persistence | null): Promise<void> {
  const current = holder[KEY];
  if (current && current !== next) await current.close();
  holder[KEY] = next ?? undefined;
  if (next) next.activate();
  else configureLedgerReadModel(null);
}
