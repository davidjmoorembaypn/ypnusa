import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { COMPARISON_GUIDES, type ComparisonGuide, type GuideOption } from "./comparison-guides";
import photos from "./blog-images/photos.json";

function allOptions(guide: ComparisonGuide): GuideOption[] {
  return guide.baseline ? [guide.baseline, ...guide.options] : guide.options;
}

function proseOf(guide: ComparisonGuide): string[] {
  const optionText = allOptions(guide).flatMap((o) => [
    o.name,
    o.category,
    o.summary,
    o.bestFor,
    o.notFor,
    o.pricing,
    ...o.highlights,
    ...Object.values(o.table),
  ]);
  return [
    guide.title,
    guide.description,
    guide.h1,
    guide.intro,
    guide.method,
    ...guide.shortAnswer,
    ...guide.howToChoose,
    ...guide.faq.flatMap((f) => [f.q, f.a]),
    ...optionText,
  ];
}

describe("comparison guides", () => {
  for (const guide of COMPARISON_GUIDES) {
    describe(guide.slug, () => {
      it("has a route file and a sitemap entry", () => {
        assert.ok(existsSync(join(process.cwd(), "src/app", guide.slug, "page.tsx")), guide.slug);
        assert.equal(guide.path, `/${guide.slug}`);
        const urls = sitemap().map((entry) => new URL(entry.url).pathname);
        assert.equal(urls.filter((u) => u === guide.path).length, 1);
      });

      it("keeps the title and description within search limits", () => {
        assert.ok(guide.title.length <= 60, `${guide.title} (${guide.title.length})`);
        assert.ok(guide.description.length <= 155, `${guide.description.length}`);
      });

      it("uses no em or en dashes and says ZIP code, not ZIP alone", () => {
        for (const text of proseOf(guide)) {
          assert.ok(!/[–—]/.test(text), text);
          assert.ok(!/\bZIP\b(?! code)/.test(text), text);
        }
      });

      it("includes YPN USA once and fills every table cell", () => {
        assert.equal(guide.options.filter((o) => o.isYpn).length, 1);
        for (const option of allOptions(guide)) {
          for (const column of guide.columns) {
            assert.ok(option.table[column.key]?.trim(), `${option.id}.${column.key}`);
          }
        }
      });

      it("cites a dated source for every option", () => {
        for (const option of allOptions(guide)) {
          assert.ok(option.sources.length > 0, option.id);
          for (const source of option.sources) {
            assert.match(source.checked, /^\d{4}-\d{2}-\d{2}$/);
            assert.ok(source.url.startsWith("https://") || source.url.startsWith("/"), source.url);
          }
        }
      });

      it("uses licensed library photos that exist on disk, with alt text", () => {
        const images = [guide.images.hero, ...guide.images.inline];
        assert.ok(guide.images.inline.length >= 1 && guide.images.inline.length <= 2);
        for (const image of images) {
          assert.ok((photos as Record<string, unknown>)[image.key], image.key);
          for (const suffix of [".webp", "-480.webp", "-og.jpg"]) {
            assert.ok(existsSync(join(process.cwd(), "public/images/blog", `${image.key}${suffix}`)), `${image.key}${suffix}`);
          }
          assert.ok(image.alt.length >= 15, image.alt);
          assert.ok(!/[\u2013\u2014]/.test(image.alt), image.alt);
        }
      });

      it("has a short FAQ for FAQPage schema", () => {
        assert.ok(guide.faq.length >= 3 && guide.faq.length <= 6);
      });

      it("matches the live YPN USA prices", () => {
        const ypn = guide.options.find((o) => o.isYpn)!;
        for (const price of ["$99", "$199", "$299"]) assert.ok(ypn.pricing.includes(price), price);
      });
    });
  }
});
