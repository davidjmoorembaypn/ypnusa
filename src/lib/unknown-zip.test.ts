import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "loanpilot-unknown-zip-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

describe("a five-digit code that isn't a U.S. ZIP code can't be checked as open or locked", async () => {
  const { isKnownZip } = await import("./geo/zip-geo");
  const { checkLedgerTerritory } = await import("./territory-ledger");
  const { applyFulfillmentEvent } = await import("./fulfillment");
  const { readDb } = await import("./db");

  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("knows real ZIP codes and not made-up ones", () => {
    assert.equal(isKnownZip("93618"), true);
    assert.equal(isKnownZip("00000"), false);
  });

  it("the availability check calls 00000 invalid, never open", () => {
    const result = checkLedgerTerritory("00000");
    assert.equal(result.valid, false);
    assert.equal(result.available, false);
    assert.match(result.message, /isn't a U\.S\. ZIP code/);
    const real = checkLedgerTerritory("93618");
    assert.equal(real.valid, true);
    assert.equal(real.city, "Dinuba");
  });

  it("a paid checkout carrying 00000 is fulfilled without locking it", async () => {
    await applyFulfillmentEvent({
      stripeCustomerId: "cus_fake_zip",
      stripeSubscriptionId: "sub_fake_zip",
      zip: "00000",
      eventType: "checkout.session.completed",
      paymentStatus: "paid",
      tier: "growth",
      customerEmail: "fake-zip@example.com",
      eventCreatedAt: 1_800_500_000,
      eventId: "evt_fake_zip",
    });
    const record = readDb().revenueSubscriptions.find((s) => s.stripeSubscriptionId === "sub_fake_zip");
    assert.ok(record);
    assert.deepEqual(record.claimedZips, []);
    assert.equal(record.status, "active");
  });
});
