import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import type { SqlClient } from "@/lib/persistence/sql-client";

/**
 * The MCP endpoint and the storage move (PR 212).
 *
 * 1. No MCP file reads the data file (store.json) or the file system: ZIP code answers come only
 *    through the paid ledger (@/lib/territory-ledger), which persistence.ts points at the
 *    configured store.
 * 2. With the ledger moved to PostgreSQL, every ZIP code tool answers from PostgreSQL's ledger,
 *    even when the data file disagrees, and a trial or a free account still holds nothing.
 */

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-mcp-storage-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const ROOT = path.resolve(__dirname, "../../..");
const MCP_SOURCES = [
  ...fs
    .readdirSync(path.join(ROOT, "src/lib/mcp"))
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => path.join("src/lib/mcp", name)),
  ...fs
    .readdirSync(path.join(ROOT, "src/app/api/mcp"), { recursive: true })
    .map(String)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join("src/app/api/mcp", name)),
];

describe("MCP endpoint storage", async () => {
  describe("source rules", () => {
    it("finds the MCP files", () => {
      assert.ok(MCP_SOURCES.includes(path.join("src/lib/mcp", "tools.ts")));
      assert.ok(MCP_SOURCES.includes(path.join("src/app/api/mcp", "route.ts")));
    });

    for (const file of MCP_SOURCES) {
      it(`${file} does not touch the data file`, () => {
        const text = fs.readFileSync(path.join(ROOT, file), "utf8");
        const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
        for (const banned of ["@/lib/db", "fs", "node:fs", "fs/promises", "node:fs/promises"]) {
          assert.ok(!imports.includes(banned), `${file} imports ${banned}`);
        }
        assert.ok(!imports.some((spec) => /(^|\/)db$/.test(spec)), `${file} imports the data file module`);
        assert.ok(!/store\.json|readDb|writeDb|revenueSubscriptions/.test(text), `${file} reads the data file or subscriptions directly`);
      });
    }

    it("the ZIP code tools reach availability only through the paid ledger", () => {
      const text = fs.readFileSync(path.join(ROOT, "src/lib/mcp/tools.ts"), "utf8");
      assert.match(text, /from "@\/lib\/territory-ledger"/);
      assert.match(text, /from "@\/lib\/zip-neighbors"/);
      // The territory module is used for ZIP code formatting only, never its data-file checks.
      const fromTerritory = /import\s*\{([^}]*)\}\s*from "@\/lib\/territory"/.exec(text)?.[1] ?? "";
      const names = fromTerritory.split(",").map((name) => name.trim()).filter(Boolean).sort();
      assert.deepEqual(names, ["isValidZip", "normalizeZip"]);
    });
  });

  describe("with the ledger in PostgreSQL", async () => {
    const { readDb, writeDb } = await import("@/lib/db");
    const { refreshLedgerReadModel } = await import("@/lib/persistence/ledger-read-model");
    const { JsonSubscriptionRepository, JsonTerritoryLedgerRepository } = await import("@/lib/repositories/json-repositories");
    const { Persistence } = await import("@/lib/repositories/persistence");
    const { replacePersistenceForTests } = await import("@/lib/repositories");
    const { createPgliteClient, subscription } = await import("@/lib/repositories/test-support");
    const { nearestZips } = await import("@/lib/geo/zip-geo");
    const { zipStatusResolver } = await import("@/lib/zip-status");
    const { POST } = await import("../../app/api/mcp/route");

    let database: SqlClient;
    let persistence: InstanceType<typeof Persistence>;

    const call = async (name: string, args: Record<string, unknown>) => {
      const response = await POST(
        new Request("https://ypnus.com/api/mcp", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
        }),
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as { result: { structuredContent: Record<string, unknown> } };
      return body.result.structuredContent;
    };

    before(async () => {
      database = await createPgliteClient();
    });
    beforeEach(async () => {
      writeDb((db) => {
        db.revenueSubscriptions.length = 0;
        db.demoRequests = [];
      });
      persistence = new Persistence({
        modes: { ledger: "postgres", subscriptions: "postgres", warnings: [] },
        json: { subscriptions: new JsonSubscriptionRepository(), ledger: new JsonTerritoryLedgerRepository() },
        // Shared by the tests, so closing an instance must not close it.
        connect: async () => ({ ...database, close: async () => undefined }),
        log: () => undefined,
      });
      await replacePersistenceForTests(persistence);
      assert.equal(await persistence.start(), true);
      zipStatusResolver.clear();
    });
    afterEach(async () => {
      await replacePersistenceForTests(null);
      await database.exec("drop table if exists zip_claims, revenue_subscriptions, persistence_state, schema_migrations cascade");
    });
    after(async () => {
      await database.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    });

    /** Makes the data file disagree with PostgreSQL, then reloads PostgreSQL's ledger. */
    async function onlyPostgresKnows() {
      writeDb((db) => {
        db.revenueSubscriptions.length = 0;
      });
      assert.equal(readDb().revenueSubscriptions.length, 0);
      assert.equal(await refreshLedgerReadModel(), true);
      zipStatusResolver.clear();
    }

    it("check_zip_availability and the batch answer from PostgreSQL, not the data file", async () => {
      const paid = await persistence.subscriptions.saveWithZipClaim(subscription(), "93618");
      assert.equal(paid.zipClaimed, true);
      await onlyPostgresKnows();

      const one = await call("check_zip_availability", { zip: "93618" });
      assert.deepEqual([one.status, one.available], ["locked", false]);

      const batch = await call("check_zip_availability_batch", { zips: ["93618", "93619"] });
      assert.deepEqual([batch.locked, batch.open], [["93618"], ["93619"]]);
    });

    it("a trial or a free account holds nothing, in PostgreSQL too", async () => {
      // A trial checkout passes no ZIP code to lock; its pick waits in pendingZip until the first payment.
      const trial = await persistence.subscriptions.saveWithZipClaim(subscription({ status: "trialing", pendingZip: "93618" }), null);
      assert.equal(trial.zipClaimed, false);
      await onlyPostgresKnows();

      const answer = await call("check_zip_availability", { zip: "93618" });
      assert.deepEqual([answer.status, answer.available], ["open", true]);
    });

    it("find_nearby_open_zips never lists a ZIP code PostgreSQL holds", async () => {
      const [nearest] = nearestZips("93618", 1);
      assert.ok(nearest, "the ZIP data has a neighbor for 93618");
      await persistence.subscriptions.saveWithZipClaim(subscription(), nearest.zip);
      await onlyPostgresKnows();

      const nearby = await call("find_nearby_open_zips", { zip: "93618", limit: 5 });
      const listed = (nearby.neighbors as Array<{ zip: string }>).map((neighbor) => neighbor.zip);
      assert.ok(listed.length > 0);
      assert.ok(!listed.includes(nearest.zip), `${nearest.zip} is held in PostgreSQL`);
    });
  });
});
