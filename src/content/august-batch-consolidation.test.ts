import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONSOLIDATED_POST_SLUGS, CONSOLIDATED_POST_TARGETS } from "@/content/august-batch-consolidation";
import { ANSWER_POSTS } from "@/content/blog-answers-2026-11";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import legacy from "@/content/legacy-redirects.json";
import wp from "@/content/wp-import/redirects.json";
import { WP_POSTS } from "@/content/wp-import";
import sitemap from "@/app/sitemap";
import { INDEXABLE_POSTS } from "@/lib/seo/clusters";

const LEGACY = legacy as Record<string, string>;
const WP = wp as Record<string, string>;
const bare = (path: string) => path.replace(/\/+$/, "");

describe("2026-08-07 batch consolidation", () => {
  it("covers exactly the migrated posts dated 2026-08-07", () => {
    const batch = WP_POSTS.filter((p) => p.date === "2026-08-07").map((p) => p.slug).sort();
    assert.equal(batch.length, 74);
    assert.deepEqual([...CONSOLIDATED_POST_SLUGS].sort(), batch);
  });

  it("sends every post to an indexable post that is not itself redirected (one hop, no chains)", () => {
    const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
    for (const [slug, target] of Object.entries(CONSOLIDATED_POST_TARGETS)) {
      assert.ok(indexable.has(target), `${slug} -> ${target} is not an indexable post`);
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(target), `${slug} -> ${target} chains`);
      assert.notEqual(slug, target);
      const existing = [...Object.keys(LEGACY), ...Object.keys(WP)].map(bare);
      assert.ok(!existing.includes(`/blog/${slug}`), `/blog/${slug} already redirects elsewhere`);
      for (const redirects of [LEGACY, WP]) {
        assert.ok(!Object.keys(redirects).some((k) => bare(k) === `/blog/${target}`), `${target} is a redirect source`);
      }
    }
  });

  it("leaves the consolidated posts out of the sitemap and every listing", () => {
    const urls = new Set(sitemap().map((entry) => entry.url));
    for (const slug of CONSOLIDATED_POST_SLUGS) {
      assert.ok(!INDEXABLE_POSTS.some((p) => p.slug === slug), `${slug} is listed`);
      assert.ok(![...urls].some((u) => u.endsWith(`/blog/${slug}`)), `${slug} is in the sitemap`);
    }
    for (const target of new Set(Object.values(CONSOLIDATED_POST_TARGETS))) {
      assert.ok([...urls].some((u) => u.endsWith(`/blog/${target}`)), `${target} is missing from the sitemap`);
    }
  });

  it("leaves the 10 answer-first posts indexable and un-redirected", () => {
    assert.equal(ANSWER_POSTS.length, 10);
    const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
    for (const post of ANSWER_POSTS) {
      assert.ok(indexable.has(post.slug), `${post.slug} is no longer indexable`);
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(post.slug), `${post.slug} is consolidated`);
    }
  });

  it("keeps the self-employed, mortgage-loans, research and markets pages in the sitemap", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    for (const prefix of ["/self-employed-mortgage", "/mortgage-loans", "/research", "/markets"]) {
      assert.ok(paths.some((path) => path === prefix || path.startsWith(`${prefix}/`)), `nothing under ${prefix}`);
    }
  });

  it("has no post that links to a consolidated post or to itself", () => {
    for (const post of ALL_BLOG_POSTS) {
      if (CONSOLIDATED_POST_SLUGS.has(post.slug)) continue;
      for (const match of post.html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)) {
        assert.notEqual(match[1], post.slug, `${post.slug} links to itself`);
        assert.ok(!CONSOLIDATED_POST_SLUGS.has(match[1]), `${post.slug} links to consolidated ${match[1]}`);
      }
    }
  });
});
