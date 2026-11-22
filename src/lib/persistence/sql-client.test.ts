import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client } from "pg";
import { SCHEMA_MIGRATIONS, runSchemaMigrations } from "./schema";
import { createPgClient, databaseSettings, pgPoolOptions, type DatabaseSettings, type SqlClient } from "./sql-client";

const base: DatabaseSettings = {
  connectionString: "postgres://ypn:secret@db.example.us-east-2.rds.amazonaws.com:5432/ypnusa",
  poolSize: 5,
  statementTimeoutMs: 5_000,
  connectTimeoutMs: 3_000,
};
const readCa = () => "-----BEGIN CERTIFICATE-----\nRDS-CA\n-----END CERTIFICATE-----\n";

/** What node-postgres will actually hand to TLS for these pool options. */
function sslTheDriverUses(options: ReturnType<typeof pgPoolOptions>): unknown {
  return (new Client(options) as unknown as { connectionParameters: { ssl: unknown } }).connectionParameters.ssl;
}

describe("database connection options", () => {
  it("with a certificate file, the driver checks against that file even when the address says sslmode=require", () => {
    for (const mode of ["require", "verify-full", "verify-ca", "prefer"]) {
      const options = pgPoolOptions({ ...base, connectionString: `${base.connectionString}?sslmode=${mode}`, caFile: "/etc/ypnusa/rds-ca.pem" }, readCa);
      assert.deepEqual(sslTheDriverUses(options), { ca: readCa(), rejectUnauthorized: true }, `sslmode=${mode}`);
      assert.equal(new URL(options.connectionString).searchParams.has("sslmode"), false);
    }
  });

  it("keeps the rest of the address as written (user, password, host, database, other options)", () => {
    const options = pgPoolOptions(
      { ...base, connectionString: `${base.connectionString}?sslmode=require&application_name=x&options=-c%20search_path%3Dypn`, caFile: "/ca.pem" },
      readCa,
    );
    const url = new URL(options.connectionString);
    assert.equal(url.username, "ypn");
    assert.equal(url.password, "secret");
    assert.equal(url.hostname, "db.example.us-east-2.rds.amazonaws.com");
    assert.equal(url.pathname, "/ypnusa");
    assert.equal(url.searchParams.get("options"), "-c search_path=ypn");
  });

  it("without a certificate file, an sslmode in the address is left to the driver", () => {
    const options = pgPoolOptions({ ...base, connectionString: `${base.connectionString}?sslmode=verify-full` }, readCa);
    assert.equal(options.connectionString, `${base.connectionString}?sslmode=verify-full`);
    assert.equal("ssl" in options, false);
  });

  it("a key=value address with a certificate file is left as written", () => {
    const options = pgPoolOptions({ ...base, connectionString: "host=db user=ypn dbname=ypnusa", caFile: "/ca.pem" }, readCa);
    assert.equal(options.connectionString, "host=db user=ypn dbname=ypnusa");
    assert.deepEqual(options.ssl, { ca: readCa(), rejectUnauthorized: true });
  });

  it("the driver gives up on a silent server shortly after the statement limit, and keeps connections alive", () => {
    const options = pgPoolOptions(base, readCa);
    assert.equal(options.statement_timeout, 5_000);
    assert.equal(options.query_timeout, 6_000);
    assert.equal(options.keepAlive, true);
    assert.equal(options.idle_in_transaction_session_timeout, 15_000);
  });

  it("databaseSettings still reads the certificate file setting", () => {
    const settings = databaseSettings({ DATABASE_URL: base.connectionString, DATABASE_CA_FILE: "/etc/ypnusa/rds-ca.pem" } as unknown as NodeJS.ProcessEnv);
    assert.equal(settings?.caFile, "/etc/ypnusa/rds-ca.pem");
  });
});

/**
 * Two servers starting at once against an empty database (a second process, or a restart that
 * overlaps the old one). Needs a PostgreSQL server: runs only when TEST_DATABASE_URL is set.
 */
const url = process.env.TEST_DATABASE_URL?.trim();

describe("migrations from several servers at once (PostgreSQL server)", { skip: url ? false : "TEST_DATABASE_URL is not set" }, () => {
  const schemas: string[] = [];
  let admin: SqlClient;

  before(async () => {
    const settings = databaseSettings({ DATABASE_URL: url } as unknown as NodeJS.ProcessEnv);
    assert.ok(settings);
    admin = await createPgClient({ ...settings, poolSize: 1 });
  });
  after(async () => {
    for (const schema of schemas) await admin?.exec(`drop schema if exists ${schema} cascade`);
    await admin?.close();
  });

  it("eight servers migrating an empty database together all succeed, and each migration is applied once", async () => {
    const settings = databaseSettings({ DATABASE_URL: url } as unknown as NodeJS.ProcessEnv);
    assert.ok(settings);
    // Several rounds: the collision on creating the bookkeeping table is a timing race.
    for (let round = 0; round < 5; round += 1) {
      const schema = `ypn_mig_${process.pid}_${Date.now()}_${round}`;
      schemas.push(schema);
      await admin.exec(`create schema ${schema}`);
      const scoped = new URL(settings.connectionString);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      const servers: SqlClient[] = await Promise.all(Array.from({ length: 8 }, () => createPgClient({ ...settings, connectionString: scoped.toString(), poolSize: 1 })));
      try {
        const results = await Promise.allSettled(servers.map((server) => runSchemaMigrations(server)));
        const failures = results.filter((result) => result.status === "rejected").map((result) => String((result as PromiseRejectedResult).reason));
        assert.deepEqual(failures, [], `round ${round}`);
        const applied: string[] = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
        assert.deepEqual([...applied].sort(), SCHEMA_MIGRATIONS.map((migration) => migration.version).sort(), `each migration applied by exactly one server (round ${round})`);
      } finally {
        await Promise.all(servers.map((server) => server.close()));
      }
    }
  });
});
