import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-db-durable-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("store durability", async () => {
  const { readDb, writeDb, storageMode } = await import("./db");
  const storePath = path.join(dataDir, "store.json");

  after(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("keeps a rolling .bak of the last good snapshot", () => {
    writeDb((db) => {
      db.analyticsEvents.length = 0;
    });
    writeDb((db) => {
      db.analyticsEvents.push({
        id: "evt_marker",
        createdAt: new Date().toISOString(),
        type: "marker",
      } as never);
    });
    assert.ok(fs.existsSync(`${storePath}.bak`), "expected store.json.bak after a second write");
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(`${storePath}.bak`, "utf8")));
  });

  it("never leaves a temp file behind after a write", () => {
    writeDb((db) => {
      db.analyticsEvents.length = 0;
    });
    const leftovers = fs.readdirSync(dataDir).filter((name) => name.endsWith(".tmp"));
    assert.deepEqual(leftovers, []);
  });

  it("quarantines a corrupt snapshot and restores from .bak instead of overwriting it", async () => {
    writeDb((db) => {
      db.analyticsEvents.length = 0;
      db.demoRequests.push({
        id: "dr_keep",
        createdAt: new Date().toISOString(),
        name: "Keep Me",
        workEmail: "keep@example.com",
        company: "Co",
        zip: "93711",
        source: "test",
        status: "new",
      });
    });
    // Force a fresh .bak that contains the record, then corrupt the live file.
    fs.copyFileSync(storePath, `${storePath}.bak`);
    fs.writeFileSync(storePath, '{"loanOfficers": [');
    // Touch mtime/size so hydrate() notices the change.
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(storePath, future, future);

    const db = readDb();
    assert.ok(
      db.demoRequests.some((r) => r.id === "dr_keep"),
      "record should be recovered from store.json.bak",
    );
    const quarantined = fs.readdirSync(dataDir).filter((n) => n.startsWith("store.json.corrupt-"));
    assert.equal(quarantined.length, 1, "corrupt file must be preserved, not deleted");
    assert.equal(storageMode().persistent, true);
  });
});
