import fs from "node:fs";
import path from "node:path";
import { storageMode } from "@/lib/db";
import { configureLedgerReadModel } from "@/lib/persistence/ledger-read-model";
import { resolvePersistenceModes } from "@/lib/persistence/mode";
import { createPgClient, databaseSettings } from "@/lib/persistence/sql-client";
import { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } from "./json-repositories";
import { Persistence, type Authority, type AuthorityMarker, type PersistenceStatus } from "./persistence";
import type { SubscriptionRepository, TerritoryLedgerRepository } from "./types";

export type { SubscriptionRepository, TerritoryLedgerRepository, ZipClaimOutcome } from "./types";
export type { ParityReport, PersistenceStatus, SyncReport } from "./persistence";

/**
 * The one place the app gets its repositories from. Which store sits behind them comes from the
 * server settings (DATABASE_URL, YPN_LEDGER_STORE, YPN_SUBSCRIPTION_STORE); with none of them
 * set, this is the data file exactly as before.
 */

// One instance per process, even when the server loads this module more than once
// (each route bundle and the start-up hook can get their own copy).
const KEY = Symbol.for("ypnusa.persistence");
const holder = globalThis as unknown as Record<symbol, Persistence | undefined>;

export const AUTHORITY_MARKER_FILE = "persistence-authority.json";

/**
 * The note beside the data file that says which store was in charge when this server last
 * finished starting. It is what stops the data file from taking payment writes after PostgreSQL
 * was in charge and before its copy has been brought back. No file means the data file has
 * always been in charge. Do not delete it by hand.
 */
export function fileAuthorityMarker(dir: string): AuthorityMarker {
  const file = path.join(dir, AUTHORITY_MARKER_FILE);
  return {
    read() {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { authority?: unknown; forced?: unknown };
        if (parsed.authority !== "json" && parsed.authority !== "postgres") return null;
        return { authority: parsed.authority as Authority, ...(parsed.forced === true ? { forced: true } : {}) };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        // The note exists but cannot be read: assume the careful answer, that PostgreSQL was in
        // charge, so nothing is decided from a copy that may be old.
        console.error("[persistence] the authority marker could not be read; treating PostgreSQL as last in charge");
        return { authority: "postgres" };
      }
    },
    write(value) {
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({ ...value, at: new Date().toISOString() }), { mode: 0o600 });
      fs.renameSync(temporary, file);
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
    localAuthority: fileAuthorityMarker(storageMode().dir),
    acceptDataFileAsTruth: ["1", "true", "yes"].includes((process.env.YPN_ACCEPT_DATA_FILE_AS_TRUTH ?? "").trim().toLowerCase()),
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
