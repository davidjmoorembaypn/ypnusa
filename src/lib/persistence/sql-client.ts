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
 * A node-postgres connection pool behind the SqlClient surface. The driver is imported here,
 * on first use, so a server with no DATABASE_URL never loads it.
 */
export async function createPgClient(settings: DatabaseSettings): Promise<SqlClient> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: settings.connectionString,
    max: settings.poolSize,
    connectionTimeoutMillis: settings.connectTimeoutMs,
    idleTimeoutMillis: 30_000,
    statement_timeout: settings.statementTimeoutMs,
    // A transaction left open by a crashed request must not hold a ZIP code's lock forever.
    idle_in_transaction_session_timeout: 15_000,
    application_name: "ypnusa-app",
    ...(settings.caFile ? { ssl: { ca: fs.readFileSync(settings.caFile, "utf8"), rejectUnauthorized: true } } : {}),
  });
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
