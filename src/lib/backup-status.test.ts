import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { BACKUP_STALE_AFTER_HOURS, backupHealth, interpretBackupStatus } from "./backup-status";

const NOW = Date.parse("2026-11-22T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe("backup health (what /api/health reports)", () => {
  it("is unknown when there is no status file, or it is empty or not JSON", () => {
    assert.equal(interpretBackupStatus(null, NOW).status, "unknown");
    assert.equal(interpretBackupStatus({}, NOW).status, "unknown");
    assert.equal(interpretBackupStatus([], NOW).status, "unknown");
    assert.equal(interpretBackupStatus("text", NOW).status, "unknown");
    assert.deepEqual(backupHealth({ YPNUSA_BACKUP_STATUS_FILE: "/nonexistent/status.json" } as unknown as NodeJS.ProcessEnv, NOW), {
      status: "unknown",
      lastSuccessAt: null,
      ageHours: null,
      offHost: null,
    });
  });

  it("is ok after a recent success, with its age and the off-host copy", () => {
    const health = interpretBackupStatus({ lastSuccessAt: hoursAgo(0.5), offHost: "ok" }, NOW);
    assert.deepEqual(health, { status: "ok", lastSuccessAt: hoursAgo(0.5), ageHours: 0.5, offHost: "ok" });
  });

  it("is stale once two hourly runs have been missed", () => {
    assert.equal(interpretBackupStatus({ lastSuccessAt: hoursAgo(BACKUP_STALE_AFTER_HOURS - 0.1) }, NOW).status, "ok");
    assert.equal(interpretBackupStatus({ lastSuccessAt: hoursAgo(BACKUP_STALE_AFTER_HOURS + 0.1) }, NOW).status, "stale");
  });

  it("is failing when the latest run failed, even right after an older success", () => {
    assert.equal(interpretBackupStatus({ lastSuccessAt: hoursAgo(1), lastFailureAt: hoursAgo(0.1) }, NOW).status, "failing");
    assert.equal(interpretBackupStatus({ lastFailureAt: hoursAgo(0.1) }, NOW).status, "failing");
    // A success after the failure clears it.
    assert.equal(interpretBackupStatus({ lastSuccessAt: hoursAgo(0.1), lastFailureAt: hoursAgo(1) }, NOW).status, "ok");
  });

  it("reports a failed S3 copy without calling the local backup failed", () => {
    const health = interpretBackupStatus({ lastSuccessAt: hoursAgo(0.2), offHost: "failed" }, NOW);
    assert.equal(health.status, "ok");
    assert.equal(health.offHost, "failed");
  });

  it("ignores values it does not understand instead of passing them on", () => {
    const health = interpretBackupStatus({ lastSuccessAt: "yesterday-ish", offHost: "s3://secret-bucket/path", lastLabel: "/var/lib" }, NOW);
    assert.equal(health.status, "unknown");
    assert.equal(health.offHost, null);
    assert.equal(JSON.stringify(health).includes("secret"), false);
  });
});

/** Runs the real aws/ops/ypnusa-backup.sh against temporary directories. */
describe("ypnusa-backup.sh writes the status file /api/health reads", () => {
  let dir = "";
  const script = path.join(process.cwd(), "aws", "ops", "ypnusa-backup.sh");
  const statusFile = () => path.join(dir, "status", "status.json");
  const readStatus = () => JSON.parse(fs.readFileSync(statusFile(), "utf8")) as Record<string, unknown>;

  function run(envLines: string[], extraPath = ""): number {
    fs.writeFileSync(path.join(dir, "app.env"), `${envLines.join("\n")}\n`);
    const result = spawnSync("bash", [script, "scheduled"], {
      env: {
        ...process.env,
        PATH: `${extraPath ? `${extraPath}:` : ""}${process.env.PATH}`,
        YPNUSA_ENV_FILE: path.join(dir, "app.env"),
        YPNUSA_BACKUP_DIR: path.join(dir, "backups"),
        YPNUSA_BACKUP_STATUS_FILE: statusFile(),
      },
      encoding: "utf8",
    });
    return result.status ?? -1;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-backup-"));
    fs.mkdirSync(path.join(dir, "data"));
    fs.writeFileSync(path.join(dir, "data", "store.json"), JSON.stringify({ revenueSubscriptions: [{ id: "s1" }], borrowerLeads: [] }));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("records a success with the size, and off-host \"off\" when no bucket is set", () => {
    assert.equal(run([`LOANPILOT_DATA_DIR=${path.join(dir, "data")}`]), 0);
    const status = readStatus();
    assert.equal(typeof status.lastSuccessAt, "string");
    assert.ok(Number(status.lastBytes) > 0);
    assert.equal(status.offHost, "off");
    assert.equal(interpretBackupStatus(status).status, "ok");
    // The status file is readable by others (the app runs as its own user); the backups are not affected.
    assert.equal(fs.statSync(statusFile()).mode & 0o044, 0o044);
  });

  it("records a failure when the data file is missing, and keeps the last success", () => {
    assert.equal(run([`LOANPILOT_DATA_DIR=${path.join(dir, "data")}`]), 0);
    const firstSuccess = readStatus().lastSuccessAt;
    fs.rmSync(path.join(dir, "data", "store.json"));
    assert.notEqual(run([`LOANPILOT_DATA_DIR=${path.join(dir, "data")}`]), 0);
    const status = readStatus();
    assert.equal(status.lastSuccessAt, firstSuccess);
    assert.equal(typeof status.lastFailureAt, "string");
    assert.equal(interpretBackupStatus(status).status, "failing");
  });

  it("records a failure when the snapshot is not valid JSON", () => {
    fs.writeFileSync(path.join(dir, "data", "store.json"), "{ truncated");
    assert.notEqual(run([`LOANPILOT_DATA_DIR=${path.join(dir, "data")}`]), 0);
    assert.equal(interpretBackupStatus(readStatus()).status, "failing");
  });

  it("records off-host \"failed\" when the S3 copy fails, and \"ok\" when it works", () => {
    const bin = path.join(dir, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "aws"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const env = [`LOANPILOT_DATA_DIR=${path.join(dir, "data")}`, "YPNUSA_BACKUP_S3_URI=s3://example-bucket/ypnusa"];
    assert.equal(run(env, bin), 0, "a failed S3 copy must not fail the local backup");
    assert.equal(readStatus().offHost, "failed");

    fs.writeFileSync(path.join(bin, "aws"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    assert.equal(run(env, bin), 0);
    assert.equal(readStatus().offHost, "ok");
    assert.equal(JSON.stringify(readStatus()).includes("example-bucket"), false, "the bucket name never reaches the status file");
  });
});
