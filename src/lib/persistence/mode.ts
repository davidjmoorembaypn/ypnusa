/**
 * Which store answers for each kind of record while data moves from the single data file to
 * PostgreSQL. Set in the server settings file; the default for both is "json", which is exactly
 * how the app behaved before the move.
 *
 *   json      The data file only. PostgreSQL answers nothing and receives no writes. (If
 *             DATABASE_URL is set, the app still connects once at start to prepare the tables
 *             and report in /api/health that the database is reachable.)
 *   shadow    The data file decides and answers. Every write is copied to PostgreSQL, and
 *             PostgreSQL's answers are compared with the data file's in the background.
 *   postgres  PostgreSQL decides and answers. Every write is copied back to the data file.
 *             If PostgreSQL cannot be reached, ZIP code checks and dashboards answer from that
 *             copy, and payment events are refused so Stripe redelivers them.
 *
 * Order of the move: the ZIP code ledger first (YPN_LEDGER_STORE), subscriptions second
 * (YPN_SUBSCRIPTION_STORE). Rolling back is setting the value back and restarting.
 */
export type StoreMode = "json" | "shadow" | "postgres";

export interface PersistenceModes {
  ledger: StoreMode;
  subscriptions: StoreMode;
  /** Why a requested mode was not honoured. Empty when the settings were used as written. */
  warnings: string[];
}

function parseMode(raw: string | undefined, name: string, warnings: string[]): StoreMode {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "json") return "json";
  if (value === "shadow" || value === "postgres") return value;
  warnings.push(`${name}="${raw}" is not json, shadow or postgres: using json.`);
  return "json";
}

export function resolvePersistenceModes(env: NodeJS.ProcessEnv = process.env): PersistenceModes {
  const warnings: string[] = [];
  let ledger = parseMode(env.YPN_LEDGER_STORE, "YPN_LEDGER_STORE", warnings);
  let subscriptions = parseMode(env.YPN_SUBSCRIPTION_STORE, "YPN_SUBSCRIPTION_STORE", warnings);

  if (!env.DATABASE_URL?.trim() && (ledger !== "json" || subscriptions !== "json")) {
    warnings.push("DATABASE_URL is not set: using the data file for everything.");
    ledger = "json";
    subscriptions = "json";
  }
  // The ledger in PostgreSQL is fed by subscription writes, so it can only be compared or trusted
  // while those writes are being copied there.
  if (ledger !== "json" && subscriptions === "json") {
    warnings.push(`YPN_LEDGER_STORE=${ledger} needs YPN_SUBSCRIPTION_STORE=shadow or postgres: using json for the ledger.`);
    ledger = "json";
  }
  // Once PostgreSQL decides who holds a ZIP code, availability must be read from it too.
  if (subscriptions === "postgres" && ledger !== "postgres") {
    warnings.push("YPN_SUBSCRIPTION_STORE=postgres needs YPN_LEDGER_STORE=postgres: using postgres for the ledger.");
    ledger = "postgres";
  }
  return { ledger, subscriptions, warnings };
}
