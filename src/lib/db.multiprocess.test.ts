import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import type { DemoRequestRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-multiprocess-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const storePath = path.join(dataDir, "store.json");
const lockPath = `${storePath}.lock`;

function demo(id: string, zip: string): DemoRequestRecord {
  return {
    id,
    createdAt: new Date().toISOString(),
    name: id,
    workEmail: `${id}@example.com`,
    company: "Test Co",
    zip,
    source: "test",
    status: "new",
  };
}

/** Reads the file directly, bypassing db.ts entirely — this is what a genuinely
 * separate Node process sharing the same data file would do. */
function readStoreFile(): { demoRequests: DemoRequestRecord[] } {
  return JSON.parse(fs.readFileSync(storePath, "utf8"));
}

/** Writes the file directly, simulating another process's flush landing on disk
 * while this process is holding an in-memory copy it loaded earlier. */
function writeStoreFile(snapshot: { demoRequests: DemoRequestRecord[] }): void {
  fs.writeFileSync(storePath, JSON.stringify(snapshot, null, 2));
}

describe("multi-process safety (db.ts)", async () => {
  const { readDb, writeDb } = await import("./db");

  before(() => {
    writeDb((db) => {
      db.demoRequests.length = 0;
    });
  });

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("readDb() picks up an external write to the data file (simulating another process)", () => {
    writeDb((db) => {
      db.demoRequests.push(demo("mp_before", "10001"));
    });

    // Bypass writeDb()/the lock entirely: a sibling process on the same host
    // would write straight to the shared file, with no knowledge of our
    // in-memory copy.
    const external = readStoreFile();
    external.demoRequests.push(demo("mp_external", "10002"));
    writeStoreFile(external);

    const ids = readDb()
      .demoRequests.map((row) => row.id)
      .sort();
    assert.deepEqual(ids, ["mp_before", "mp_external"]);
  });

  it("writeDb() reloads before mutating, so a concurrent external write is kept, not clobbered", () => {
    writeDb((db) => {
      db.demoRequests.length = 0;
      db.demoRequests.push(demo("mp2_before", "20001"));
    });

    const external = readStoreFile();
    external.demoRequests.push(demo("mp2_external", "20002"));
    writeStoreFile(external);

    // If writeDb() flushed its stale in-memory snapshot instead of reloading
    // first, this would silently drop "mp2_external" from disk.
    writeDb((db) => {
      db.demoRequests.push(demo("mp2_own", "20003"));
    });

    const onDisk = readStoreFile()
      .demoRequests.map((row) => row.id)
      .sort();
    assert.deepEqual(onDisk, ["mp2_before", "mp2_external", "mp2_own"]);

    const viaReadDb = readDb()
      .demoRequests.map((row) => row.id)
      .sort();
    assert.deepEqual(viaReadDb, ["mp2_before", "mp2_external", "mp2_own"]);
  });

  it("breaks a stale lock file (mtime older than 10s) and still completes the write", () => {
    writeDb((db) => {
      db.demoRequests.length = 0;
    });

    fs.writeFileSync(lockPath, "");
    const staleTime = new Date(Date.now() - 11_000);
    fs.utimesSync(lockPath, staleTime, staleTime);

    writeDb((db) => {
      db.demoRequests.push(demo("mp3_after_stale_lock", "30001"));
    });

    assert.equal(fs.existsSync(lockPath), false);
    const ids = readDb().demoRequests.map((row) => row.id);
    assert.deepEqual(ids, ["mp3_after_stale_lock"]);
  });

  it("does not leave a lock file behind after a write", () => {
    writeDb((db) => {
      db.demoRequests.push(demo("mp4_no_lock_left", "40001"));
    });

    assert.equal(fs.existsSync(lockPath), false);
  });
});
