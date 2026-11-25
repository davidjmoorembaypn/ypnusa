import { test } from "node:test";
import assert from "node:assert/strict";
import { METRO_AREA_HMDA, METRO_AREA_META } from "@/content/metro-areas-data";
import {
  METRO_AREAS,
  UNIQUENESS_THRESHOLD,
  applications,
  indexableMetroAreaSlugs,
  maxSimilarity,
  metroAreaDescription,
  metroAreaFindings,
  metroAreaPageText,
  metroAreaPlays,
  metroAreaTitle,
  statsFor,
} from "@/content/metro-areas";
import { metroAreaForZip, metroAreaZips } from "@/lib/metro-area-zips";

test("there are exactly 100 metro areas with unique codes and slugs", () => {
  assert.equal(METRO_AREA_META.length, 100);
  assert.equal(new Set(METRO_AREA_META.map((m) => m.code)).size, 100);
  assert.equal(new Set(METRO_AREA_META.map((m) => m.slug)).size, 100);
  for (const m of METRO_AREA_META) assert.ok(METRO_AREA_HMDA[m.code], `no data for ${m.code}`);
});

test("loan types and purposes add up to originations for every metro", () => {
  for (const m of METRO_AREA_META) {
    const d = METRO_AREA_HMDA[m.code].y2024;
    const n = d.actions.originated.count;
    const types = Object.values(d.loanTypes).reduce((s, x) => s + x.count, 0);
    const purposes = Object.values(d.purposes).reduce((s, x) => s + x.count, 0);
    assert.equal(types, n, `${m.slug} loan types`);
    assert.equal(purposes, n, `${m.slug} purposes`);
    assert.ok(n > 10000, `${m.slug} has ${n} loans`);
    assert.ok(applications(d.actions) > n, `${m.slug} applications`);
  }
});

test("ranks run 1..100 by originations", () => {
  METRO_AREAS.forEach((m, i) => {
    assert.equal(m.rank, i + 1);
    if (i) assert.ok(statsFor(METRO_AREAS[i - 1]).originations >= statsFor(m).originations);
  });
});

test("titles and descriptions fit search results and use house style", () => {
  for (const m of METRO_AREAS) {
    assert.ok(metroAreaTitle(m).length <= 60, metroAreaTitle(m));
    const text = `${metroAreaTitle(m)} ${metroAreaDescription(m)} ${metroAreaPageText(m)}`;
    assert.doesNotMatch(text, /Young Professional/i);
    assert.doesNotMatch(text, /\bZIP\b(?! code)/, `bare ZIP in ${m.slug}`);
    assert.doesNotMatch(text, /NaN|undefined|Infinity/, m.slug);
  }
});

test("every page has four findings and three distinct plays", () => {
  for (const m of METRO_AREAS) {
    assert.equal(metroAreaFindings(m).length, 4, m.slug);
    const plays = metroAreaPlays(m);
    assert.equal(plays.length, 3, m.slug);
    assert.equal(new Set(plays.map((p) => p.title)).size, 3, m.slug);
  }
});

test("page text is unique: no two metros share more than the threshold of 5-word shingles", () => {
  const scores = METRO_AREAS.map((m) => ({ slug: m.slug, ...maxSimilarity(m) }));
  const worst = scores.reduce((a, b) => (b.score > a.score ? b : a));
  assert.ok(worst.score <= UNIQUENESS_THRESHOLD, `${worst.slug} vs ${worst.other}: ${worst.score}`);
  assert.equal(indexableMetroAreaSlugs().size, 100);
});

test("ZIP code links go both ways", () => {
  const houston = METRO_AREAS.find((m) => m.slug === "houston-tx")!;
  const zips = metroAreaZips(houston);
  assert.ok(zips.length > 10);
  for (const z of zips) assert.equal(metroAreaForZip(z)?.slug, "houston-tx");
  assert.equal(metroAreaForZip({ city: "Wilmington", state: "NC" })?.slug, "wilmington-nc");
  assert.equal(metroAreaForZip({ city: "Wilmington", state: "DE" })?.slug, "wilmington-de");
  assert.equal(metroAreaForZip({ city: "Nowhere", state: "TX" }), undefined);
});

test("metroAreasMentionedIn finds clear city names and skips ambiguous ones without a state", async () => {
  const { metroAreasMentionedIn } = await import("@/content/metro-areas");
  const slugs = (t: string) => metroAreasMentionedIn(t).map((m) => m.slug);
  assert.deepEqual(slugs("<p>Buyers left Phoenix, AZ for Fresno. Fresno prices rose.</p>"), ["phoenix-az", "fresno-ca"]);
  assert.deepEqual(slugs("If a paragraph could be copied onto a Miami site, delete it."), []);
  assert.deepEqual(slugs("Portland and Columbus are growing."), []);
  assert.deepEqual(slugs("Leads in Portland, OR and Columbus, OH"), ["portland-or", "columbus-oh"]);
  assert.deepEqual(slugs("Leads in Washington, DC"), ["washington-dc"]);
  assert.equal(metroAreasMentionedIn("Houston, TX Dallas, TX Austin, TX Denver, CO Tampa, FL").length, 4);
  assert.deepEqual(slugs("<a href=\"/x\" title=\"Fresno\">a link</a>"), []);
});
