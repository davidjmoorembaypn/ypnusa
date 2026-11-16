import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { decryptValue, encryptValue, isEncryptedValue, piiEncryptionStatus } from "./pii";
import { inspectSnapshot, openSnapshot, resetPiiSnapshotWarningsForTests, sealSnapshot } from "./pii-snapshot";

const KEY = crypto.randomBytes(32).toString("base64");
const OTHER_KEY = crypto.randomBytes(32).toString("base64");

function withKey(key: string | undefined) {
  if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = key;
}

describe("PII field encryption", () => {
  beforeEach(() => withKey(KEY));
  afterEach(() => withKey(undefined));

  it("round-trips strings, numbers, objects and arrays with their types", () => {
    for (const value of ["jane@example.com", 412000, { phone: "5595550100", band: "680-719" }, ["a", "b"]]) {
      const sealed = encryptValue(value);
      assert.ok(isEncryptedValue(sealed));
      assert.ok(!String(sealed).includes("jane@example.com"));
      assert.deepEqual(decryptValue(sealed), { ok: true, value });
    }
  });

  it("uses a fresh IV, so the same value encrypts differently each time", () => {
    assert.notEqual(encryptValue("same"), encryptValue("same"));
  });

  it("never encrypts twice", () => {
    const once = encryptValue("x");
    assert.equal(encryptValue(once), once);
  });

  it("detects tampering and keeps the ciphertext instead of returning garbage", () => {
    const sealed = String(encryptValue("secret"));
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    assert.deepEqual(decryptValue(tampered), { ok: false, value: tampered });
  });

  it("cannot be read with a different key", () => {
    const sealed = encryptValue("secret");
    withKey(OTHER_KEY);
    assert.equal(decryptValue(sealed).ok, false);
  });

  it("is off without a key: values stay plain, ciphertext is left untouched", () => {
    const sealed = encryptValue("secret");
    withKey(undefined);
    assert.equal(piiEncryptionStatus(), "off");
    assert.equal(encryptValue("plain"), "plain");
    assert.deepEqual(decryptValue(sealed), { ok: false, value: sealed });
  });

  it("treats a malformed key as invalid and does not encrypt with it", () => {
    withKey("too-short");
    assert.equal(piiEncryptionStatus(), "invalid");
    assert.equal(encryptValue("plain"), "plain");
  });
});

describe("data file sealing", () => {
  beforeEach(() => {
    withKey(KEY);
    resetPiiSnapshotWarningsForTests();
  });
  afterEach(() => withKey(undefined));

  const snapshot = {
    borrowerLeads: [{ id: "lead_1", assignedLoId: "lo_1", answers: { name: "Jane Doe", email: "jane@example.com" } }],
    propertyEvaluations: [{ id: "pe_1", zip: "93277", name: "Jane", email: "jane@example.com", currentMortgageBalanceUsd: 250000 }],
    analyticsEvents: [{ id: "evt_1", type: "page_view" }],
  };

  it("encrypts only personal fields and leaves ids and routing readable", () => {
    const sealed = sealSnapshot(snapshot);
    const text = JSON.stringify(sealed);
    assert.ok(!text.includes("jane@example.com"));
    assert.ok(!text.includes("250000"));
    assert.ok(text.includes("lead_1") && text.includes("lo_1") && text.includes("93277") && text.includes("page_view"));
    assert.deepEqual(inspectSnapshot(sealed), { encrypted: 4, plain: 0, undecryptable: 0 });
  });

  it("does not mutate the in-memory store", () => {
    const before = JSON.stringify(snapshot);
    sealSnapshot(snapshot);
    assert.equal(JSON.stringify(snapshot), before);
  });

  it("opens back to the original", () => {
    assert.deepEqual(openSnapshot(sealSnapshot(snapshot)), snapshot);
  });

  it("keeps undecryptable fields as ciphertext rather than dropping them", () => {
    const sealed = sealSnapshot(snapshot) as typeof snapshot;
    withKey(undefined);
    const opened = openSnapshot(sealed) as typeof snapshot;
    assert.deepEqual(opened.borrowerLeads[0].answers, sealed.borrowerLeads[0].answers);
    assert.ok(isEncryptedValue(opened.borrowerLeads[0].answers));
  });
});

describe("store.json on disk", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-pii-"));
  process.env.LOANPILOT_DATA_DIR = dataDir;
  withKey(KEY);
  const { readDb, writeDb } = await import("../db");
  const storePath = path.join(dataDir, "store.json");

  after(() => {
    withKey(undefined);
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it("writes borrower PII encrypted and reads it back in plain text", () => {
    withKey(KEY);
    writeDb((db) => {
      db.demoRequests.push({
        id: "demo_pii",
        createdAt: new Date().toISOString(),
        name: "Pat Example",
        workEmail: "pat@example.com",
        company: "Example Mortgage",
        phone: "559-555-0100",
        status: "new",
      });
    });
    const onDisk = fs.readFileSync(storePath, "utf8");
    assert.ok(!onDisk.includes("pat@example.com"), "email must not be on disk in plain text");
    assert.ok(!onDisk.includes("559-555-0100"), "phone must not be on disk in plain text");
    assert.ok(onDisk.includes("Example Mortgage"), "non-personal fields stay readable");
    const stored = readDb().demoRequests.find((item) => item.id === "demo_pii");
    assert.equal(stored?.workEmail, "pat@example.com");
    assert.equal(stored?.phone, "559-555-0100");
  });
});
