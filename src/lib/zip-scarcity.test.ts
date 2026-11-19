import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-zip-scarcity-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const neighbors = (zips: string[]) => ({
  neighbors: zips.map((zip, i) => ({ zip, city: "Del Rey", state: "CA", miles: i + 1.5 })),
  unknownCount: 2,
  checked: zips.length + 2,
});

describe("onZipCodeLocked", async () => {
  const { onZipCodeLocked, scheduleZipLockHook, zipLockHookEnabled } = await import("./zip-scarcity");
  const { listZipScarcityEvents, readDb } = await import("./db");

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("records one alert with an outreach payload per open neighbor", async () => {
    const result = await onZipCodeLocked("93618", "sub_1", "checkout", {
      findNeighbors: async () => neighbors(["93616", "93646"]),
      now: () => new Date("2026-11-19T10:00:00Z"),
      newId: () => "zse_test_1",
    });
    assert.deepEqual(result, { recorded: true, neighborCount: 2 });
    const [event] = listZipScarcityEvents();
    assert.equal(event.id, "zse_test_1");
    assert.equal(event.lockedZip, "93618");
    assert.equal(event.lockedCity, "Dinuba");
    assert.equal(event.ownerRef, "sub_1");
    assert.equal(event.trigger, "checkout");
    assert.equal(event.unknownCount, 2);
    assert.deepEqual(event.neighbors.map((n) => n.zip), ["93616", "93646"]);
    const first = event.neighbors[0];
    assert.equal(first.outreach.email_fomo.subject, "Heads up on 93616 (neighboring 93618 just closed)");
    assert.match(first.outreach.email_fomo.body, /\{\{First_Name\}\}/);
    assert.match(first.outreach.linkedin_dm.body, /93616 in Del Rey/);
    assert.match(first.outreach.branch_audit_pitch.body, /territory-audit\?zip=93616/);
  });

  it("stores no name or email, only an opaque owner id", () => {
    const json = JSON.stringify(readDb().zipScarcityEvents);
    assert.ok(!/@[a-z0-9-]+\.[a-z]{2,}/i.test(json.replace(/\{\{Email\}\}/g, "")), "unexpected email address in the stored event");
  });

  it("does not record the same ZIP code and owner twice (redelivered webhook)", async () => {
    const again = await onZipCodeLocked("93618", "sub_1", "checkout", { findNeighbors: async () => neighbors(["93616"]) });
    assert.equal(again.recorded, false);
    assert.equal(listZipScarcityEvents(10).filter((e) => e.lockedZip === "93618").length, 1);
  });

  it("records nothing when there are no open neighbors, and rejects bad input", async () => {
    const none = await onZipCodeLocked("90210", "sub_2", "checkout", { findNeighbors: async () => neighbors([]) });
    assert.equal(none.recorded, false);
    assert.equal((await onZipCodeLocked("123", "sub_2")).recorded, false);
    assert.equal((await onZipCodeLocked("93618", "")).recorded, false);
  });

  it("swallows failures instead of throwing into the webhook", async () => {
    const result = await onZipCodeLocked("93618", "sub_3", "checkout", {
      findNeighbors: async () => {
        throw new Error("ledger down");
      },
    });
    assert.equal(result.recorded, false);
  });

  it("lists newest first", async () => {
    await onZipCodeLocked("93619", "sub_4", "first_payment", {
      findNeighbors: async () => neighbors(["93616"]),
      now: () => new Date("2026-11-19T11:00:00Z"),
      newId: () => "zse_test_2",
    });
    assert.equal(listZipScarcityEvents()[0].id, "zse_test_2");
  });

  it("is on in production or with ZIP_SCARCITY_HOOK=on, and off elsewhere", () => {
    assert.equal(zipLockHookEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv), true);
    assert.equal(zipLockHookEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv), false);
    assert.equal(zipLockHookEnabled({ NODE_ENV: "development", ZIP_SCARCITY_HOOK: "on" } as NodeJS.ProcessEnv), true);
    assert.equal(zipLockHookEnabled({ NODE_ENV: "production", ZIP_SCARCITY_HOOK: "off" } as NodeJS.ProcessEnv), false);
    // With the hook disabled (the default outside production) scheduling is a silent no-op.
    assert.doesNotThrow(() => scheduleZipLockHook("93618", "sub_9", "checkout"));
  });
});
