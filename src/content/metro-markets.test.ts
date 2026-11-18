import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import legacy from "./legacy-redirects.json";
import { METRO_HMDA_2024 } from "./metro-markets-data";
import { METRO_MARKETS, metroDescription, metroFaq, metroPath, metroTakeaways, metroTitle, relatedMetros } from "./metro-markets";
import { WP_MARKET_PAGES } from "./wp-import";

const LEGACY = legacy as Record<string, string>;

describe("big-city market pages", () => {
  it("have unique slugs that don't collide with migrated /markets pages", () => {
    const slugs = METRO_MARKETS.map((m) => m.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    const wpSlugs = new Set(WP_MARKET_PAGES.map((p) => p.slug));
    for (const s of slugs) assert.ok(!wpSlugs.has(s), `${s} is also a WordPress /markets page`);
  });

  it("each have HMDA data whose loan types add up to the total", () => {
    for (const m of METRO_MARKETS) {
      const d = METRO_HMDA_2024[m.fips];
      assert.ok(d, `${m.slug} has no data`);
      const types = Object.values(d.loanTypes);
      assert.equal(types.reduce((a, t) => a + t.count, 0), d.total.count, m.slug);
      // Purposes are queried separately; they cover everything except code 5 (not applicable).
      const purposes = Object.values(d.purposes).reduce((a, p) => a + p.count, 0);
      assert.ok(purposes <= d.total.count && purposes >= d.total.count * 0.99, `${m.slug} purposes ${purposes} vs ${d.total.count}`);
      assert.ok(d.purposes.purchase.count > 0 && d.loanTypes.conventional.count > 0, m.slug);
    }
  });

  it("keep titles and descriptions within search limits", () => {
    for (const m of METRO_MARKETS) {
      assert.ok(metroTitle(m).length <= 60, `${metroTitle(m)} (${metroTitle(m).length})`);
      assert.ok(metroDescription(m).length <= 160, `${m.slug} description ${metroDescription(m).length}`);
    }
  });

  it("never mention rates, promises or the old brand name", () => {
    for (const m of METRO_MARKETS) {
      const text = [...m.localNotes, ...metroTakeaways(m), ...metroFaq(m).flatMap((f) => [f.q, f.a])].join(" ");
      assert.doesNotMatch(text, /Young Professional/i, m.slug);
      assert.doesNotMatch(text, /\d(\.\d+)?\s*%\s*(APR|interest|rate)/i, m.slug);
      assert.doesNotMatch(text, /guarantee(d)? (leads|results|approval)/i, m.slug);
    }
  });

  it("send every old address to its page in one hop", () => {
    for (const m of METRO_MARKETS) {
      for (const p of m.legacyPaths) assert.equal(LEGACY[p], metroPath(m), p);
    }
    for (const [source, dest] of Object.entries(LEGACY)) {
      if (source.startsWith("/markets/leads-in-")) assert.notEqual(dest, "/loan-officers", `${source} still goes to the generic hub`);
    }
  });

  it("are in the sitemap once each", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const m of METRO_MARKETS) assert.equal(urls.filter((u) => u === metroPath(m)).length, 1, m.slug);
  });

  it("link to related markets other than themselves", () => {
    for (const m of METRO_MARKETS) {
      const related = relatedMetros(m);
      assert.equal(related.length, 5);
      assert.ok(!related.some((r) => r.slug === m.slug));
    }
  });
});
