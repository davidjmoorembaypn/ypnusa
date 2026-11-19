import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import type { RevenueSubscriptionRecord } from "./types";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ypnus-zip-index-"));
process.env.LOANPILOT_DATA_DIR = dataDir;

const FLAGSHIP = ["93618", "93654", "93631", "93662", "93611", "93619", "93711", "93720", "93722", "93277", "93291", "93292", "93230", "93274", "93637"];

function paidSub(zip: string, overrides: Partial<RevenueSubscriptionRecord> = {}): RevenueSubscriptionRecord {
  return {
    id: `sub_${zip}`,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    tier: "growth",
    status: "active",
    source: "stripe_webhook",
    stripeSubscriptionId: `stripe_${zip}`,
    stripeCustomerId: `cus_${zip}`,
    claimedZips: [zip],
    ...overrides,
  };
}

describe("ZIP page indexation gate", async () => {
  const { writeDb } = await import("./db");
  const { indexableZips, isZipIndexable, nearestIndexableZips, zipCanonicalUrl, zipIndexReason } = await import("./zip-index");
  const { FLAGSHIP_ZIPS } = await import("../content/zip-flagship");
  const { buildZipLocalIntel } = await import("../content/zip-local-intel");
  const { default: sitemap } = await import("../app/sitemap");
  const { generateMetadata } = await import("../app/zip/[zipcode]/page");

  const robotsFor = async (zipcode: string) => (await generateMetadata({ params: Promise.resolve({ zipcode }) })).robots;
  const zipUrls = () => sitemap().map((e) => new URL(e.url).pathname).filter((p) => p.startsWith("/zip/"));

  beforeEach(() => {
    writeDb((db) => {
      db.revenueSubscriptions = [];
    });
  });
  after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

  it("the flagship list is exactly the 15 agreed ZIP codes", () => {
    assert.deepEqual(FLAGSHIP_ZIPS.map((z) => z.zip).sort(), [...FLAGSHIP].sort());
    assert.equal(new Set(FLAGSHIP_ZIPS.map((z) => z.zip)).size, 15);
  });

  it("indexes flagship and hand-written ZIP codes, and nothing else, when nobody has claimed a ZIP code", () => {
    for (const zip of FLAGSHIP) assert.equal(zipIndexReason(zip), "flagship", zip);
    assert.equal(zipIndexReason("93612"), "profile");
    for (const zip of ["90210", "10001", "93616", "60614"]) assert.equal(isZipIndexable(zip), false, zip);
    assert.deepEqual(indexableZips(), [...FLAGSHIP, "93612"].sort());
  });

  it("indexes a ZIP code only while a paying loan officer holds it", () => {
    writeDb((db) => {
      db.revenueSubscriptions = [
        paidSub("90210"),
        paidSub("10001", { source: "seed" }),
        paidSub("60614", { status: "cancelled" }),
        paidSub("33139", { status: "trialing", claimedZips: [], pendingZip: "33139" }),
      ];
    });
    assert.equal(zipIndexReason("90210"), "claimed");
    for (const zip of ["10001", "60614", "33139"]) assert.equal(isZipIndexable(zip), false, zip);
    assert.equal(indexableZips().length, 17);
    writeDb((db) => {
      db.revenueSubscriptions = [];
    });
    assert.equal(isZipIndexable("90210"), false);
  });

  it("never indexes a malformed ZIP code or one that is not a real ZIP code", () => {
    for (const zip of ["1234", "abcde", "00000", ""]) assert.equal(isZipIndexable(zip, new Set([zip])), false, zip);
  });

  it("puts exactly the indexable ZIP pages in the sitemap", () => {
    assert.deepEqual(zipUrls().sort(), [...FLAGSHIP, "93612"].sort().map((z) => `/zip/${z}`));
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub("90210")];
    });
    assert.equal(zipUrls().length, 17);
    assert.ok(zipUrls().includes("/zip/90210"));
  });

  it("sets robots from the gate: noindex,follow by default, index,follow when allowed", async () => {
    assert.deepEqual(await robotsFor("93618"), { index: true, follow: true });
    assert.deepEqual(await robotsFor("93612"), { index: true, follow: true });
    assert.deepEqual(await robotsFor("90210"), { index: false, follow: true });
    writeDb((db) => {
      db.revenueSubscriptions = [paidSub("90210")];
    });
    assert.deepEqual(await robotsFor("90210"), { index: true, follow: true });
  });

  it("uses a clean self-referencing canonical", async () => {
    assert.equal(zipCanonicalUrl("93618", "https://ypnus.com"), "https://ypnus.com/zip/93618");
    const meta = await generateMetadata({ params: Promise.resolve({ zipcode: "93618" }) });
    assert.equal(meta.alternates?.canonical, "https://ypnus.com/zip/93618");
    assert.ok(!String(meta.alternates?.canonical).includes("?"));
  });

  it("links only to indexable neighbors, nearest first, never to itself", () => {
    const near = nearestIndexableZips("93618", 5);
    assert.equal(near.length, 5);
    for (const n of near) assert.ok(isZipIndexable(n.zip) && n.zip !== "93618", n.zip);
    for (let i = 1; i < near.length; i += 1) assert.ok(near[i].miles >= near[i - 1].miles);
    // A ZIP code far from every indexable one has no neighbor links.
    assert.deepEqual(nearestIndexableZips("10001", 5), []);
  });

  it("gives every flagship ZIP code four local FAQs with the checked county figures", () => {
    const seen = new Set<string>();
    for (const zip of FLAGSHIP) {
      const intel = buildZipLocalIntel(zip)!;
      assert.equal(intel.faqs.length, 4, zip);
      assert.ok(intel.county, zip);
      const text = intel.faqs.map((f) => `${f.q} ${f.a}`).join(" ");
      assert.match(text, /\$832,750/);
      assert.match(text, /\$541,287/);
      assert.match(text, /CalHFA/);
      assert.ok(text.includes(zip));
      for (const f of intel.faqs) {
        assert.ok(!seen.has(f.q), `duplicate question across ZIP codes: ${f.q}`);
        seen.add(f.q);
      }
    }
  });

  it("shows no dollar limits for a ZIP code outside the checked counties, and never quotes a rate", () => {
    const intel = buildZipLocalIntel("90210")!;
    assert.equal(intel.county, null);
    assert.equal(intel.faqs.length, 4);
    const text = intel.faqs.map((f) => `${f.q} ${f.a}`).join(" ");
    assert.ok(!/\$\d/.test(text), "no dollar figures for an unchecked county");
    for (const zip of [...FLAGSHIP, "90210"]) {
      const all = buildZipLocalIntel(zip)!.faqs.map((f) => f.a).join(" ");
      assert.ok(!/\d(\.\d+)?\s?% (interest )?rate|APR|pre-?approved|guaranteed (leads|loans|approval|results)/i.test(all.replace(/base property tax rate/g, "")), zip);
    }
    assert.equal(buildZipLocalIntel("00000"), null);
  });
});
