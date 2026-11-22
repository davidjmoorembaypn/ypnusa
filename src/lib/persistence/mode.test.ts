import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePersistenceModes } from "./mode";
import { DatabaseUnavailableError, databaseSettings, isConnectionError, isDataError, pgPoolOptions } from "./sql-client";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const URL = "postgres://app@db.internal:5432/ypnusa";

describe("which store answers (persistence modes)", () => {
  it("uses the data file for everything when nothing is set", () => {
    assert.deepEqual(resolvePersistenceModes(env({})), { ledger: "json", subscriptions: "json", warnings: [] });
    assert.deepEqual(resolvePersistenceModes(env({ DATABASE_URL: URL })), { ledger: "json", subscriptions: "json", warnings: [] });
  });

  it("never leaves the data file without a database connection", () => {
    const modes = resolvePersistenceModes(env({ YPN_LEDGER_STORE: "postgres", YPN_SUBSCRIPTION_STORE: "postgres" }));
    assert.equal(modes.ledger, "json");
    assert.equal(modes.subscriptions, "json");
    assert.equal(modes.warnings.length, 1);
  });

  it("follows the rollout order: both shadow, then the ledger, then subscriptions", () => {
    const at = (ledger: string, subscriptions: string) =>
      resolvePersistenceModes(env({ DATABASE_URL: URL, YPN_LEDGER_STORE: ledger, YPN_SUBSCRIPTION_STORE: subscriptions }));
    assert.deepEqual(at("shadow", "shadow"), { ledger: "shadow", subscriptions: "shadow", warnings: [] });
    assert.deepEqual(at("postgres", "shadow"), { ledger: "postgres", subscriptions: "shadow", warnings: [] });
    assert.deepEqual(at("postgres", "postgres"), { ledger: "postgres", subscriptions: "postgres", warnings: [] });
    assert.deepEqual(at(" Postgres ", "SHADOW"), { ledger: "postgres", subscriptions: "shadow", warnings: [] });
  });

  it("refuses combinations that would read a ledger nobody is writing", () => {
    const ledgerOnly = resolvePersistenceModes(env({ DATABASE_URL: URL, YPN_LEDGER_STORE: "postgres" }));
    assert.equal(ledgerOnly.ledger, "json");
    assert.equal(ledgerOnly.warnings.length, 1);

    const subscriptionsFirst = resolvePersistenceModes(env({ DATABASE_URL: URL, YPN_SUBSCRIPTION_STORE: "postgres" }));
    assert.equal(subscriptionsFirst.ledger, "postgres");
    assert.equal(subscriptionsFirst.subscriptions, "postgres");
    assert.equal(subscriptionsFirst.warnings.length, 1);
  });

  it("treats a typo as the data file and says so", () => {
    const modes = resolvePersistenceModes(env({ DATABASE_URL: URL, YPN_LEDGER_STORE: "postgress", YPN_SUBSCRIPTION_STORE: "shadow" }));
    assert.equal(modes.ledger, "json");
    assert.match(modes.warnings[0], /YPN_LEDGER_STORE/);
  });

  it("reads the connection settings with safe limits", () => {
    assert.equal(databaseSettings(env({})), null);
    assert.equal(databaseSettings(env({ DATABASE_URL: "  " })), null);
    assert.deepEqual(databaseSettings(env({ DATABASE_URL: URL })), {
      connectionString: URL,
      caFile: undefined,
      poolSize: 5,
      statementTimeoutMs: 5000,
      connectTimeoutMs: 3000,
    });
    const tuned = databaseSettings(
      env({ DATABASE_URL: URL, DATABASE_POOL_SIZE: "500", DATABASE_STATEMENT_TIMEOUT_MS: "1", DATABASE_CA_FILE: "/etc/ypnusa/rds-ca.pem" }),
    );
    assert.equal(tuned?.poolSize, 20);
    assert.equal(tuned?.statementTimeoutMs, 250);
    assert.equal(tuned?.caFile, "/etc/ypnusa/rds-ca.pem");
  });

  it("with a certificate file, the certificate is checked against that file whatever the address says", () => {
    const settings = databaseSettings(env({ DATABASE_URL: `${URL}?sslmode=require&application_name=x`, DATABASE_CA_FILE: "/etc/ypnusa/rds-ca.pem" }));
    assert.ok(settings);
    const options = pgPoolOptions(settings, (file) => `PEM from ${file}`);
    assert.deepEqual(options.ssl, { ca: "PEM from /etc/ypnusa/rds-ca.pem", rejectUnauthorized: true });
    // An sslmode left in the address would make the driver ignore the file.
    assert.equal(options.connectionString.includes("sslmode"), false);
    assert.equal(options.connectionString.includes("application_name=x"), true);
    assert.equal(options.query_timeout, options.statement_timeout + 1_000);
    assert.equal(options.keepAlive, true);

    const plain = pgPoolOptions(databaseSettings(env({ DATABASE_URL: `${URL}?sslmode=require` }))!);
    assert.equal("ssl" in plain, false);
    assert.equal(plain.connectionString, `${URL}?sslmode=require`);
  });

  it("tells a lost connection from a rejected record", () => {
    for (const error of [
      Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), { code: "ECONNREFUSED" }),
      Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }),
      Object.assign(new Error("connection failure"), { code: "08006" }),
      new Error("timeout exceeded when trying to connect"),
      new Error("Connection terminated unexpectedly"),
      new DatabaseUnavailableError(),
    ]) {
      assert.equal(isConnectionError(error), true, error.message);
    }
    for (const error of [
      Object.assign(new Error("violates check constraint"), { code: "23514" }),
      Object.assign(new Error("invalid input syntax for type timestamp"), { code: "22007" }),
      new Error("something else"),
      null,
    ]) {
      assert.equal(isConnectionError(error), false);
    }
    assert.equal(isDataError(Object.assign(new Error("x"), { code: "23P01" })), true);
    assert.equal(isDataError(Object.assign(new Error("x"), { code: "08006" })), false);
  });
});
