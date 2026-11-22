import type { SqlClient, SqlExecutor } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";

/**
 * Test helpers only (nothing in the app imports this file).
 *
 * `createPgliteClient` runs a real PostgreSQL engine inside the test process, so the SQL, the
 * constraints and the transactions under test are PostgreSQL's own, with no server to install.
 * It has one connection, so it cannot run two transactions at the same moment: the true race is
 * covered by postgres-concurrency.test.ts against a PostgreSQL server.
 */
export async function createPgliteClient(): Promise<SqlClient> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
  const database = new PGlite({ extensions: { btree_gist } });

  type Target = {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; affectedRows?: number }>;
    exec: (text: string) => Promise<unknown>;
  };
  const executor = (target: Target): SqlExecutor => ({
    async query<T>(text: string, params: unknown[] = []) {
      const result = await target.query(text, params);
      return { rows: result.rows as T[], rowCount: result.affectedRows ?? result.rows.length };
    },
    async exec(text: string) {
      await target.exec(text);
    },
  });

  return {
    ...executor(database as unknown as Target),
    transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      return database.transaction((tx) => fn(executor(tx as unknown as Target))) as Promise<T>;
    },
    async close() {
      await database.close();
    },
  };
}

/** Wraps a client so a test can take the database "down" and bring it back. */
export function withOutageSwitch(client: SqlClient): SqlClient & { down: boolean } {
  const fail = () => Promise.reject(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));
  const switched: SqlClient & { down: boolean } = {
    down: false,
    query: ((text: string, params?: unknown[]) => (switched.down ? fail() : client.query(text, params))) as SqlClient["query"],
    exec: (text: string) => (switched.down ? fail() : client.exec(text)),
    transaction: ((fn: (tx: SqlExecutor) => Promise<unknown>) => (switched.down ? fail() : client.transaction(fn))) as SqlClient["transaction"],
    close: () => client.close(),
  };
  return switched;
}

let sequence = 0;

/** A paid subscription with every optional field left out unless given. */
export function subscription(overrides: Partial<RevenueSubscriptionRecord> = {}): RevenueSubscriptionRecord {
  sequence += 1;
  return {
    id: `sub_test_${sequence}`,
    createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, sequence)).toISOString(),
    startedAt: new Date(Date.UTC(2026, 10, 1, 0, 0, sequence)).toISOString(),
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    stripeCustomerId: `cus_${sequence}`,
    stripeSubscriptionId: `stripe_sub_${sequence}`,
    claimedZips: [],
    ...overrides,
  };
}
