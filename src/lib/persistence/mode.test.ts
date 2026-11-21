import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePersistenceModes } from "./mode";
import { databaseSettings } from "./sql-client";

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
});
