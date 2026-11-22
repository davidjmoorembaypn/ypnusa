import fs from "node:fs";

/**
 * The smallest database surface the repositories need, so the same repository code runs on
 * node-postgres in production and on an in-process PostgreSQL in tests.
 */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  /** Runs a script of several statements with no parameters (migrations only). */
  exec(text: string): Promise<void>;
}

export interface SqlClient extends SqlExecutor {
  /** Runs `fn` in one transaction: commit when it resolves, roll back when it throws. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Thrown when PostgreSQL is selected for a write but cannot be reached. Callers answer 503. */
export class DatabaseUnavailableError extends Error {
  readonly code = "DATABASE_UNAVAILABLE";
  constructor(message = "The database is not reachable right now.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

const CONNECTION_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  // PostgreSQL: the server is shutting down, starting up, or out of connections.
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);

/**
 * True when the error means the database could not be reached or dropped the connection, as
 * opposed to rejecting one statement. Only this kind of error means "the database is down".
 */
export function isConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code === "string" && (CONNECTION_ERROR_CODES.has(code) || code.startsWith("08"))) return true;
  return typeof message === "string" && /timeout exceeded when trying to connect|Connection terminated|connection timeout|Query read timeout|ECONNREFUSED/i.test(message);
}

/** True when PostgreSQL rejected the values of one record (a bad value or a broken rule), not the connection. */
export function isDataError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code } = error as { code?: unknown };
  return typeof code === "string" && (code.startsWith("22") || code.startsWith("23"));
}

export interface DatabaseSettings {
  connectionString: string;
  /** PEM bundle for a private certificate authority (Amazon RDS). Optional for hosts with public certificates. */
  caFile?: string;
  poolSize: number;
  statementTimeoutMs: number;
  connectTimeoutMs: number;
}

/** Reads the database settings from the environment. Null when no database is configured. */
export function databaseSettings(env: NodeJS.ProcessEnv = process.env): DatabaseSettings | null {
  const connectionString = env.DATABASE_URL?.trim();
  if (!connectionString) return null;
  const int = (value: string | undefined, fallback: number, min: number, max: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
  };
  return {
    connectionString,
    caFile: env.DATABASE_CA_FILE?.trim() || undefined,
    poolSize: int(env.DATABASE_POOL_SIZE, 5, 1, 20),
    statementTimeoutMs: int(env.DATABASE_STATEMENT_TIMEOUT_MS, 5_000, 250, 60_000),
    connectTimeoutMs: int(env.DATABASE_CONNECT_TIMEOUT_MS, 3_000, 250, 30_000),
  };
}

/**
 * The options handed to the driver. With a certificate file (Amazon RDS), the certificate is
 * checked against that file and nothing else: an `sslmode` in the address would make the driver
 * drop the file and check against the system's certificates, which do not include Amazon's.
 */
export function pgPoolOptions(settings: DatabaseSettings, readFile: (path: string) => string = (path) => fs.readFileSync(path, "utf8")) {
  let connectionString = settings.connectionString;
  let ssl: { ca: string; rejectUnauthorized: true } | undefined;
  if (settings.caFile) {
    ssl = { ca: readFile(settings.caFile), rejectUnauthorized: true };
    try {
      const url = new URL(connectionString);
      for (const name of ["sslmode", "sslrootcert", "sslcert", "sslkey", "ssl"]) url.searchParams.delete(name);
      connectionString = url.toString();
    } catch {
      // Not a URL (a key=value address): leave it as written.
    }
  }
  return {
    connectionString,
    max: settings.poolSize,
    connectionTimeoutMillis: settings.connectTimeoutMs,
    idleTimeoutMillis: 30_000,
    // The server stops a statement after this long...
    statement_timeout: settings.statementTimeoutMs,
    // ...and the driver gives up a second later even if the server never answers at all.
    query_timeout: settings.statementTimeoutMs + 1_000,
    // A transaction left open by a crashed request must not hold a ZIP code's lock forever.
    idle_in_transaction_session_timeout: 15_000,
    // Notice a connection the network dropped silently.
    keepAlive: true,
    application_name: "ypnusa-app",
    ...(ssl ? { ssl } : {}),
  };
}

/**
 * A node-postgres connection pool behind the SqlClient surface. The driver is imported here,
 * on first use, so a server with no DATABASE_URL never loads it.
 */
export async function createPgClient(settings: DatabaseSettings): Promise<SqlClient> {
  const { Pool } = await import("pg");
  const pool = new Pool(pgPoolOptions(settings));
  // An idle connection dropped by the server must not crash the process.
  pool.on("error", (error) => console.error("[database] idle connection error:", error.message));

  type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };
  const executor = (target: Queryable): SqlExecutor => ({
    async query<T>(text: string, params: unknown[] = []) {
      const result = await target.query(text, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    },
    async exec(text: string) {
      await target.query(text);
    },
  });

  return {
    ...executor(pool),
    async transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const connection = await pool.connect();
      try {
        await connection.query("begin");
        const value = await fn(executor(connection));
        await connection.query("commit");
        return value;
      } catch (error) {
        await connection.query("rollback").catch(() => undefined);
        throw error;
      } finally {
        connection.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}
