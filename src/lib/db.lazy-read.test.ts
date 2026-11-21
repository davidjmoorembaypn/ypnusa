import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-lazy-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
const storePath = path.join(dataDir, "store.json");

describe("readDb() copies one collection at a time", async () => {
  const { readDb, writeDb, storageMode, SNAPSHOT_LIMITS } = await import("./db");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("returns copies, so a caller cannot change live state", () => {
    writeDb((db) => {
      db.demoRequests.length = 0;
      db.demoRequests.push({ id: "d1", createdAt: "2026-11-21T00:00:00.000Z", name: "A", workEmail: "a@example.com", company: "Co", zip: "93618", source: "test", status: "new" });
    });
    const snapshot = readDb();
    snapshot.demoRequests[0].name = "changed";
    snapshot.demoRequests.push({ ...snapshot.demoRequests[0], id: "d2" });
    const fresh = readDb();
    assert.equal(fresh.demoRequests.length, 1);
    assert.equal(fresh.demoRequests[0].name, "A");
  });

  it("gives the same copy on repeated access, and accepts assignment", () => {
    const snapshot = readDb();
    assert.equal(snapshot.demoRequests, snapshot.demoRequests);
    snapshot.demoRequests = [];
    assert.deepEqual(snapshot.demoRequests, []);
    assert.equal(readDb().demoRequests.length, 1);
  });

  it("still looks like the whole store: same keys, serializable, cloneable", () => {
    const snapshot = readDb();
    const keys = Object.keys(snapshot).sort();
    assert.ok(keys.includes("revenueSubscriptions") && keys.includes("borrowerLeads") && keys.includes("siteOptimizer"));
    assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(snapshot))).sort(), keys);
    assert.deepEqual(Object.keys({ ...readDb() }).sort(), keys);
  });

  it("writeDb() returns the state after the write", () => {
    const after = writeDb((db) => {
      db.demoRequests.push({ id: "d3", createdAt: "2026-11-21T00:00:00.000Z", name: "B", workEmail: "b@example.com", company: "Co", zip: "93619", source: "test", status: "new" });
    });
    assert.deepEqual(after.demoRequests.map((d) => d.id), ["d1", "d3"]);
    after.demoRequests.length = 0;
    assert.equal(readDb().demoRequests.length, 2);
  });

  it("writes the snapshot as compact JSON and reports its size", () => {
    const raw = fs.readFileSync(storePath, "utf8");
    assert.ok(!raw.includes("\n"), "the snapshot is one line, not indented");
    assert.doesNotThrow(() => JSON.parse(raw));
    const mode = storageMode();
    assert.equal(mode.sizeBytes, Buffer.byteLength(raw));
    assert.equal(mode.headroom, "ok");
    assert.ok(SNAPSHOT_LIMITS.warnBytes < SNAPSHOT_LIMITS.criticalBytes && SNAPSHOT_LIMITS.criticalBytes < SNAPSHOT_LIMITS.hardLimitBytes);
  });
});
