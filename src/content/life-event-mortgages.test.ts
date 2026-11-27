import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sitemap from "@/app/sitemap";
import { PROGRAM_LIST } from "@/lib/programs";
import { parseFunnelSourceParam } from "@/lib/local-seo";
import { LIFE_EVENT_GUIDES, LIFE_EVENT_HUB_PATH, LIFE_EVENT_FUNNEL_SOURCE, LIFE_EVENT_INTAKE_HREF, LIFE_EVENT_REVIEWED_ON, lifeEventGuidePath, type LifeEventGuide } from "./life-event-mortgages";

/** Language these borrower pages must never use: rate quotes, payment estimates, approval promises. */
const FORBIDDEN = [
  /\d+(\.\d+)?\s*%/,
  /\b(apr|interest rate of)\b/i,
  /\$\s?\d[\d,]*\s*(\/|per|a)\s*(mo|month)/i,
  /\bguarantee/i,
  /pre-?approved in/i,
  /you(?:'ll| will) (?:be approved|qualify)/i,
  /no credit check/i,
  /\b(act now|limited[\s-]time|lowest rates?|best rates?)\b/i,
  /—/,
];

/** Sources a guide may cite: agencies, the law, and the two guide publishers. */
const SOURCE_HOSTS = /^https:\/\/(selling-guide\.fanniemae\.com|servicing-guide\.fanniemae\.com|www\.hud\.gov|www\.consumerfinance\.gov|www\.law\.cornell\.edu|www\.irs\.gov|www\.va\.gov|www\.vba\.va\.gov|www\.benefits\.va\.gov)\//;

function allText(guide: LifeEventGuide): string[] {
  return [
    guide.title, guide.metaTitle, guide.description, guide.intro, ...guide.keyPoints, ...guide.documents,
    ...guide.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.bullets ?? [])]),
    ...guide.faqs.flatMap((faq) => [faq.q, faq.a]),
  ];
}

describe("life-event mortgage guides", () => {
  it("has six guides with unique slugs and titles", () => {
    assert.equal(LIFE_EVENT_GUIDES.length, 6);
    assert.equal(new Set(LIFE_EVENT_GUIDES.map((guide) => guide.slug)).size, 6);
    assert.equal(new Set(LIFE_EVENT_GUIDES.map((guide) => guide.metaTitle)).size, 6);
    for (const guide of LIFE_EVENT_GUIDES) assert.match(guide.slug, /^[a-z]+(-[a-z]+)*$/);
  });

  it("never quotes a rate, a payment or a promise", () => {
    for (const guide of LIFE_EVENT_GUIDES) {
      for (const text of allText(guide)) {
        for (const pattern of FORBIDDEN) assert.doesNotMatch(text, pattern, `${guide.slug}: "${text.slice(0, 80)}" matches ${pattern}`);
      }
    }
  });

  it("gives every guide enough substance and its sources", () => {
    for (const guide of LIFE_EVENT_GUIDES) {
      assert.ok(guide.sections.length >= 4, `${guide.slug} sections`);
      assert.ok(guide.keyPoints.length >= 3 && guide.documents.length >= 4 && guide.faqs.length >= 3, `${guide.slug} lists`);
      assert.ok(guide.sources.length >= 5, `${guide.slug} sources`);
      assert.equal(new Set(guide.sources.map((source) => source.url)).size, guide.sources.length, `${guide.slug} duplicate source`);
      for (const source of guide.sources) assert.match(source.url, SOURCE_HOSTS, `${guide.slug}: ${source.url}`);
      // The page adds " | YPN USA" (10 characters); the whole title should stay near 65.
      assert.ok(guide.metaTitle.length <= 55, `${guide.slug} title is ${guide.metaTitle.length} characters`);
      assert.ok(guide.description.length >= 110 && guide.description.length <= 160, `${guide.slug} description is ${guide.description.length} characters`);
      assert.match(guide.intro, /lender can set stricter/);
      assert.equal(new Set(guide.faqs.map((faq) => faq.q)).size, guide.faqs.length);
    }
  });

  it("links only to loan program pages that exist", () => {
    const programPaths = new Set(PROGRAM_LIST.map((program) => `/mortgage-loans/${program.toLowerCase()}`));
    for (const guide of LIFE_EVENT_GUIDES) {
      for (const link of guide.relatedPrograms) assert.ok(programPaths.has(link.href), `${guide.slug}: ${link.href}`);
    }
  });

  it("sends borrowers to the borrower intake with a source tag the intake accepts", () => {
    assert.equal(LIFE_EVENT_INTAKE_HREF, `/embed/intake?funnelSource=${LIFE_EVENT_FUNNEL_SOURCE}`);
    assert.equal(parseFunnelSourceParam(LIFE_EVENT_FUNNEL_SOURCE), LIFE_EVENT_FUNNEL_SOURCE);
    // The tag must not say which life event the borrower read about.
    assert.doesNotMatch(LIFE_EVENT_FUNNEL_SOURCE, /divorce|married|marri|family|inherit|retire/i);
  });

  it("is in the sitemap with its review date", () => {
    const urls = new Map(sitemap().map((entry) => [new URL(entry.url).pathname, entry]));
    for (const path of [LIFE_EVENT_HUB_PATH, ...LIFE_EVENT_GUIDES.map(lifeEventGuidePath)]) {
      const entry = urls.get(path);
      assert.ok(entry, `${path} missing from the sitemap`);
      assert.equal(new Date(entry.lastModified as Date).toISOString().slice(0, 10), LIFE_EVENT_REVIEWED_ON);
    }
  });
});
