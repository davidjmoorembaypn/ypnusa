import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-failclosed-"));
process.env.LOANPILOT_DATA_DIR = dataDir;
const storePath = path.join(dataDir, "store.json");

/** A store with one really-sold ZIP code and some leads, as it would sit on the server. */
const REAL_STORE = {
  borrowerLeads: Array.from({ length: 25 }, (_, i) => ({ id: `lead_${i}` })),
  revenueSubscriptions: [
    {
      id: "sub_real",
      createdAt: "2026-11-01T00:00:00.000Z",
      startedAt: "2026-11-01T00:00:00.000Z",
      tier: "growth",
      status: "active",
      source: "stripe_webhook",
      ownerEmail: "officer@example.com",
      claimedZips: ["93618"],
      monthlyPriceCents: 9900,
      lifetimeMonths: 1,
    },
  ],
};

/** Makes every read of the data file fail with a disk error until restore() is called. */
function breakReads(): () => void {
  const original = fs.readFileSync;
  (fs as { readFileSync: unknown }).readFileSync = function (target: unknown, ...rest: unknown[]) {
    if (String(target) === storePath) {
      throw Object.assign(new Error("EIO: i/o error, read"), { code: "EIO" });
    }
    return (original as (...args: unknown[]) => unknown).call(fs, target, ...rest);
  };
  return () => {
    (fs as { readFileSync: unknown }).readFileSync = original;
  };
}

describe("store fails closed when the data file cannot be read", async () => {
  fs.writeFileSync(storePath, JSON.stringify(REAL_STORE));
  const onDiskBefore = fs.readFileSync(storePath, "utf8");
  const restoreReads = breakReads();

  const { readDb, writeDb, storageMode, StoreUnavailableError } = await import("./db");
  const { checkLedgerTerritory } = await import("./territory-ledger");

  after(() => {
    restoreReads();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("refuses to read instead of answering from an empty store", () => {
    assert.throws(() => readDb(), StoreUnavailableError);
  });

  it("never reports a sold ZIP code as open", () => {
    // Before the fix this returned { available: true } for a ZIP code a customer had paid for.
    assert.throws(() => checkLedgerTerritory("93618"), StoreUnavailableError);
  });

  it("refuses to write, and leaves the real data file untouched", () => {
    assert.throws(
      () =>
        writeDb((db) => {
          db.analyticsEvents.push({ id: "evt", createdAt: new Date().toISOString(), type: "marker" } as never);
        }),
      StoreUnavailableError,
    );
    restoreReads();
    assert.equal(fs.readFileSync(storePath, "utf8"), onDiskBefore, "the data file must not be replaced");
    assert.deepEqual(
      fs.readdirSync(dataDir).filter((name) => name !== "store.json"),
      [],
      "no .bak, temp or lock file may be left behind by a refused write",
    );
  });

  it("reports the outage on the health path without throwing", () => {
    const undo = breakReads();
    try {
      const mode = storageMode();
      assert.equal(mode.unavailable, true);
      assert.equal(mode.persistent, false);
      assert.match(mode.error ?? "", /Unreadable data snapshot/);
    } finally {
      undo();
    }
  });

  it("recovers by itself once the file reads again, with every record intact", async () => {
    // A failed read is retried at most once a second.
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    const db = readDb();
    assert.equal(db.borrowerLeads.length, 25);
    assert.equal(db.revenueSubscriptions[0]?.id, "sub_real");
    assert.equal(checkLedgerTerritory("93618").available, false);
    const mode = storageMode();
    assert.equal(mode.unavailable, false);
    assert.equal(mode.persistent, true);
    assert.equal(mode.error, undefined);
  });
});
