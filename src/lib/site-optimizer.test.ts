import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypn-site-optimizer-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

import { readDb } from "./db";
import { marketingMetadata } from "./seo";
import {
  findOpportunities,
  gscStatus,
  installGscKey,
  isProtectedPath,
  isRunDue,
  OPTIMIZER_RUN_VERSION,
  RUNNING_LABEL,
  proposeChange,
  revertChange,
  verifyPendingChanges,
} from "./site-optimizer";

const row = (page: string, query: string, impressions: number, clicks: number, position: number) => ({
  page,
  query,
  impressions,
  clicks,
  ctr: clicks / impressions,
  position,
});

describe("findOpportunities", () => {
  it("picks seen-but-not-clicked pages and skips protected ones and other hosts", () => {
    const opps = findOpportunities([
      row("https://ypnus.com/loan-officers/visalia-ca", "visalia loan officer leads", 400, 2, 8),
      row("https://ypnus.com/loan-officers/visalia-ca", "mortgage leads visalia", 100, 0, 11),
      row("https://ypnus.com/pricing", "ypn pricing", 900, 1, 5),
      row("https://ypnus.com/blog/good-page", "already clicked", 200, 40, 3),
      row("https://other.com/x", "x", 999, 0, 5),
    ]);
    // /pricing stays in (the run proposes it for approval); other hosts never do.
    assert.deepEqual(opps.map((o) => o.path).sort(), ["/loan-officers/visalia-ca", "/pricing"]);
    const visalia = opps.find((o) => o.path === "/loan-officers/visalia-ca");
    assert.equal(visalia?.topQueries[0], "visalia loan officer leads");
    assert.equal(visalia?.impressions, 500);
  });

  it("uses page-only rows for totals when present, so dropped rare queries don't hide a page", () => {
    const opps = findOpportunities([
      { page: "http://ypnus.com/", clicks: 0, impressions: 108, ctr: 0, position: 6.9 },
      { page: "https://ypnus.com/", clicks: 3, impressions: 40, ctr: 0.075, position: 7.1 },
      row("http://ypnus.com/", "ypn", 10, 0, 4.6),
      row("http://ypnus.com/", "loans", 9, 0, 18.8),
    ]);
    assert.equal(opps.length, 1);
    assert.equal(opps[0].path, "/");
    assert.equal(opps[0].impressions, 148);
    assert.deepEqual(opps[0].topQueries, ["ypn", "loans"]);
  });

  it("protects money, legal and the homepage", () => {
    assert.ok(isProtectedPath("/") && isProtectedPath("/pricing") && isProtectedPath("/privacy-policy"));
    assert.ok(!isProtectedPath("/loan-officers/visalia-ca"));
  });
});

describe("changes", () => {
  it("rejects non-compliant or badly sized text", async () => {
    const bad = await proposeChange({ path: "/cerebro", field: "title", value: "Guaranteed lowest rates", reason: "t", source: "cerebro_auto" });
    assert.equal(bad.ok, false);
  });

  it("holds protected pages for approval and applies others, which marketingMetadata then uses", async () => {
    const held = await proposeChange({ path: "/pricing", field: "title", value: "YPN USA plans for mortgage loan officers", reason: "t", source: "cerebro_auto" });
    assert.ok(held.ok && held.record.status === "proposed");
    const live = await proposeChange({ path: "https://ypnus.com/cerebro/", field: "title", value: "Cerebro: the AI assistant for loan officers", reason: "t", source: "cerebro_auto", previousValue: "Old" });
    assert.ok(live.ok && live.record.status === "live" && live.record.path === "/cerebro");
    const meta = marketingMetadata({ title: "Coded title", description: "Coded description", path: "/cerebro" });
    assert.deepEqual(meta.title, { absolute: "Cerebro: the AI assistant for loan officers" });
    assert.equal(marketingMetadata({ title: "Coded title", description: "d", path: "/pricing" }).title, "Coded title");
  });

  it("confirms changes that show, rolls back errors and changes that never show", async () => {
    const shows = await proposeChange({ path: "/teams", field: "description", value: "Cerebro answers and qualifies borrowers for mortgage teams around the clock, with one shared lead view.", reason: "t", source: "cerebro_auto" });
    const errors = await proposeChange({ path: "/roi", field: "title", value: "Loan officer payback calculator for YPN USA", reason: "t", source: "cerebro_auto" });
    assert.ok(shows.ok && errors.ok);
    const results = await verifyPendingChanges(async (p) =>
      p === "/teams"
        ? { status: 200, description: "Cerebro answers and qualifies borrowers for mortgage teams around the clock, with one shared lead view." }
        : p === "/roi"
          ? { status: 500 }
          : { status: 200, title: "something else" },
    );
    const byId = new Map(results.map((r) => [r.id, r.result]));
    assert.equal(byId.get(shows.record.id), "ok");
    assert.equal(byId.get(errors.record.id), "reverted");
    // /cerebro never showed the new title: waiting now, rolled back after the deadline.
    const later = await verifyPendingChanges(async () => ({ status: 200, title: "something else" }), Date.now() + 60 * 60 * 1000);
    assert.ok(later.some((r) => r.result === "reverted"));
    assert.equal(marketingMetadata({ title: "Coded title", description: "d", path: "/cerebro" }).title, "Coded title");
  });

  it("rolls back on request and keeps the record", async () => {
    const live = await proposeChange({ path: "/features", field: "title", value: "YPN USA features for mortgage loan officers", reason: "t", source: "admin" });
    assert.ok(live.ok);
    await revertChange(live.record.id);
    assert.equal(readDb().siteOverrides.find((r) => r.id === live.record.id)?.status, "reverted");
  });
});

describe("Search Console key", () => {
  it("accepts only a service account key and never stores anything else", () => {
    process.env.GSC_KEY_FILE = path.join(dataDir, "secrets", "gsc.json");
    assert.equal(installGscKey("not json").ok, false);
    assert.equal(installGscKey(JSON.stringify({ type: "user" })).ok, false);
    const ok = installGscKey(JSON.stringify({ type: "service_account", client_email: "bot@p.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" }));
    assert.ok(ok.ok);
    assert.deepEqual(gscStatus(), { connected: true, serviceAccount: "bot@p.iam.gserviceaccount.com" });
    assert.equal(fs.statSync(process.env.GSC_KEY_FILE).mode & 0o777, 0o600);
  });
});

describe("isRunDue", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  const recent = "2026-11-16T11:00:00Z";
  it("reruns a run cut off by a restart", () => {
    assert.equal(isRunDue({ lastRunAt: recent, lastRunSummary: RUNNING_LABEL, runVersion: OPTIMIZER_RUN_VERSION }, now), true);
  });
  it("reruns results from an older optimizer version", () => {
    assert.equal(isRunDue({ lastRunAt: recent, lastRunSummary: "Run finished: 0 page(s)" }, now), true);
  });
  it("waits a week after a current finished run", () => {
    assert.equal(isRunDue({ lastRunAt: recent, lastRunSummary: "Read 12 pages", runVersion: OPTIMIZER_RUN_VERSION }, now), false);
    assert.equal(isRunDue({ lastRunAt: "2026-11-01T00:00:00Z", lastRunSummary: "Read 12 pages", runVersion: OPTIMIZER_RUN_VERSION }, now), true);
  });
});
