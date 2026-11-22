import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, describe, it } from "node:test";
import type { SqlClient } from "@/lib/persistence/sql-client";
import type { RevenueSubscriptionRecord } from "@/lib/types";
import type { SubscriptionRepository, TerritoryLedgerRepository } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-repository-contract-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

/**
 * One set of behaviour, run against both stores. If the data file and PostgreSQL ever disagree
 * about who gets a ZIP code, a test here fails: this is what makes the move backwards compatible.
 */
interface Harness {
  name: string;
  setUp: () => Promise<{ subscriptions: SubscriptionRepository; ledger: TerritoryLedgerRepository; setNow?: (ms: number) => void }>;
  reset: () => Promise<void>;
  tearDown: () => Promise<void>;
}

let client: SqlClient | null = null;
let postgresNow = Date.now();

const harnesses: Harness[] = [
  {
    name: "data file",
    async setUp() {
      const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("./json-repositories");
      return { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() };
    },
    async reset() {
      const { writeDb } = await import("@/lib/db");
      writeDb((db) => {
        db.revenueSubscriptions.length = 0;
      });
    },
    async tearDown() {
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  },
  {
    name: "PostgreSQL",
    async setUp() {
      const { createPgliteClient } = await import("./test-support");
      const { runSchemaMigrations } = await import("@/lib/persistence/schema");
      const { PostgresSubscriptionRepository, PostgresTerritoryLedgerRepository } = await import("./postgres-repositories");
      client = await createPgliteClient();
      await runSchemaMigrations(client);
      postgresNow = Date.now();
      return {
        subscriptions: new PostgresSubscriptionRepository(client, () => postgresNow),
        ledger: new PostgresTerritoryLedgerRepository(client),
      };
    },
    async reset() {
      await client?.exec("truncate zip_claims, revenue_subscriptions");
    },
    async tearDown() {
      await client?.close();
    },
  },
];

for (const harness of harnesses) {
  describe(`repository contract: ${harness.name}`, () => {
    let subscriptions: SubscriptionRepository;
    let ledger: TerritoryLedgerRepository;
    let subscription: (overrides?: Partial<RevenueSubscriptionRecord>) => RevenueSubscriptionRecord;

    before(async () => {
      ({ subscriptions, ledger } = await harness.setUp());
      ({ subscription } = await import("./test-support"));
      await harness.reset();
    });
    afterEach(() => harness.reset());
    after(() => harness.tearDown());

    it("stores a subscription with every field and returns it unchanged", async () => {
      const { sameSubscription, differingFields } = await import("./subscription-record");
      const full = subscription({
        ownerLoId: "lo_1",
        ownerEmail: "officer@example.com",
        company: "Valley Home Loans",
        claimedZips: ["93618"],
        countyTerritories: ["Tulare"],
        monthlyPriceCents: 9900,
        lifetimeMonths: 3,
        attributedDemoRequestIds: ["demo_1", "demo_2"],
        lastStripeEventId: "evt_1",
        lastStripeEventCreatedAt: 1_800_000_000,
        pendingZip: "93291",
        expiresAt: "2031-11-21T00:00:00.000Z",
        stripePaymentIntentId: "pi_1",
        zipLockConflict: { zip: "93277", at: "2026-11-21T10:00:00.000Z" },
        addon: "extra_zip",
      });
      await subscriptions.save(full);
      const byId = await subscriptions.findById(full.id);
      assert.ok(byId);
      assert.deepEqual(differingFields(full, byId), []);
      assert.deepEqual(byId, full);
      const byStripe = await subscriptions.findByStripeSubscriptionId(full.stripeSubscriptionId as string);
      assert.ok(byStripe && sameSubscription(full, byStripe));
      assert.equal(await subscriptions.findById("missing"), null);
      assert.equal(await subscriptions.findByStripeSubscriptionId("missing"), null);

      const minimal = subscription({ stripeCustomerId: undefined, stripeSubscriptionId: undefined });
      await subscriptions.save(minimal);
      const storedMinimal = await subscriptions.findById(minimal.id);
      assert.ok(storedMinimal);
      // Absent and undefined optional fields are the same record.
      assert.deepEqual(differingFields(minimal, storedMinimal), []);
      assert.deepEqual(JSON.parse(JSON.stringify(storedMinimal)), JSON.parse(JSON.stringify(minimal)));
      assert.deepEqual((await subscriptions.list()).map((record) => record.id).sort(), [full.id, minimal.id].sort());
    });

    it("saving again replaces the record instead of adding a second one", async () => {
      const record = subscription({ company: "Before" });
      await subscriptions.save(record);
      await subscriptions.save({ ...record, company: "After", status: "cancelled" });
      const all = await subscriptions.list();
      assert.equal(all.length, 1);
      assert.equal(all[0].company, "After");
      assert.equal(all[0].status, "cancelled");
    });

    it("the first payment locks the ZIP code; a second officer's payment is saved without it", async () => {
      const first = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.deepEqual(
        { claimed: first.zipClaimed, conflict: first.zipConflict, newlyLocked: first.zipNewlyLocked },
        { claimed: true, conflict: false, newlyLocked: true },
      );
      assert.deepEqual(first.record.claimedZips, ["93618"]);

      const second = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.deepEqual(
        { claimed: second.zipClaimed, conflict: second.zipConflict, newlyLocked: second.zipNewlyLocked },
        { claimed: false, conflict: true, newlyLocked: false },
      );
      assert.deepEqual(second.record.claimedZips, []);
      // The payment already happened, so the second subscription is still stored.
      assert.deepEqual((await subscriptions.findById(second.record.id))?.claimedZips, []);
      assert.deepEqual([...(await ledger.paidClaimedZips())], ["93618"]);
      assert.equal(await ledger.isPaidClaimed("93618"), true);
      assert.equal(await ledger.isPaidClaimed("93291"), false);
    });

    it("the same customer's replacement plan takes the ZIP code over without a conflict", async () => {
      const old = await subscriptions.saveWithZipClaim(subscription({ stripeCustomerId: "cus_same" }), "93618");
      const replacement = await subscriptions.saveWithZipClaim(subscription({ stripeCustomerId: "cus_same" }), "93618");
      assert.equal(replacement.zipClaimed, true);
      assert.equal(replacement.zipConflict, false);
      // The territory was already taken, so nobody is told a new ZIP code was locked.
      assert.equal(replacement.zipNewlyLocked, false);

      // Stripe's delete event for the old plan arrives afterwards: the ZIP code stays held.
      await subscriptions.save({ ...old.record, status: "cancelled" });
      assert.equal(await ledger.isPaidClaimed("93618"), true);
      const outsider = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(outsider.zipConflict, true);
    });

    it("two plans with no Stripe customer are two holders: only one can lock a ZIP code", async () => {
      const admin = { source: "admin_adjustment" as const, stripeCustomerId: undefined, stripeSubscriptionId: undefined };
      const first = await subscriptions.saveWithZipClaim(subscription(admin), "93618");
      const second = await subscriptions.saveWithZipClaim(subscription(admin), "93618");
      assert.equal(first.zipClaimed, true);
      assert.equal(second.zipConflict, true);
      assert.deepEqual(second.record.claimedZips, []);
    });

    it("saving the holder again is not a new lock and not a conflict", async () => {
      const first = await subscriptions.saveWithZipClaim(subscription(), "93618");
      const again = await subscriptions.saveWithZipClaim(first.record, "93618");
      assert.deepEqual(
        { claimed: again.zipClaimed, conflict: again.zipConflict, newlyLocked: again.zipNewlyLocked },
        { claimed: false, conflict: false, newlyLocked: false },
      );
      assert.deepEqual(again.record.claimedZips, ["93618"]);
    });

    it("a cancellation releases the ZIP code for the next officer", async () => {
      const first = await subscriptions.saveWithZipClaim(subscription(), "93618");
      await subscriptions.save({ ...first.record, status: "cancelled" });
      assert.equal(await ledger.isPaidClaimed("93618"), false);

      const next = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(next.zipClaimed, true);
      assert.equal(next.zipNewlyLocked, true);
      assert.deepEqual([...(await ledger.paidClaimedZips())], ["93618"]);
    });

    it("a prepaid term that has ended no longer holds its ZIP code", async () => {
      const ended = await subscriptions.saveWithZipClaim(
        subscription({ expiresAt: new Date(Date.now() - 60_000).toISOString() }),
        "93618",
      );
      assert.equal(ended.zipClaimed, true);
      assert.equal(await ledger.isPaidClaimed("93618"), false);
      const next = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(next.zipConflict, false);
      assert.equal(next.zipNewlyLocked, true);

      // A term that ends in the future holds it until then.
      const future = Date.now() + 5 * 365 * 24 * 3600 * 1000;
      await subscriptions.saveWithZipClaim(subscription({ expiresAt: new Date(future).toISOString() }), "93291");
      assert.equal(await ledger.isPaidClaimed("93291"), true);
      assert.equal(await ledger.isPaidClaimed("93291", future + 1), false);
    });

    it("on a conflict, a stale copy of the ZIP code is removed from the losing subscription", async () => {
      await subscriptions.saveWithZipClaim(subscription(), "93618");
      const stale = subscription({ status: "cancelled", claimedZips: ["93618", "93291"] });
      await subscriptions.save(stale);
      const reactivated = await subscriptions.saveWithZipClaim({ ...stale, status: "active" }, "93618");
      assert.equal(reactivated.zipConflict, true);
      assert.deepEqual(reactivated.record.claimedZips, ["93291"]);
    });

    it("a trial checkout (no ZIP code to lock) stores the subscription and holds nothing", async () => {
      const trial = await subscriptions.saveWithZipClaim(subscription({ status: "trialing", pendingZip: "93618" }), null);
      assert.deepEqual(
        { claimed: trial.zipClaimed, conflict: trial.zipConflict, newlyLocked: trial.zipNewlyLocked },
        { claimed: false, conflict: false, newlyLocked: false },
      );
      assert.equal(await ledger.isPaidClaimed("93618"), false);
      assert.equal((await subscriptions.findById(trial.record.id))?.pendingZip, "93618");
    });

    it("only paid plans appear in the paid ledger, but any live plan blocks a second holder", async () => {
      const demo = await subscriptions.saveWithZipClaim(subscription({ source: "demo_request", stripeCustomerId: undefined }), "93618");
      assert.equal(demo.zipClaimed, true);
      assert.equal(await ledger.isPaidClaimed("93618"), false);
      const paid = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(paid.zipConflict, true);

      await subscriptions.saveWithZipClaim(subscription({ source: "admin_adjustment", stripeCustomerId: undefined }), "93291");
      assert.deepEqual([...(await ledger.paidClaimedZips())], ["93291"]);
    });

    it("removing a ZIP code from a subscription frees it", async () => {
      const first = await subscriptions.saveWithZipClaim(subscription(), "93618");
      await subscriptions.save({ ...first.record, claimedZips: [] });
      assert.equal(await ledger.isPaidClaimed("93618"), false);
      const next = await subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(next.zipNewlyLocked, true);
    });
  });
}
