import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANSWER_POSTS } from "./blog-answers-2026-11";
import { ALL_BLOG_POSTS } from "./blog-all";
import { BLOG_POST_PHOTOS } from "@/lib/blog-images";
import { INDEXABLE_POSTS, getCluster } from "@/lib/seo/clusters";

const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("answer-first posts (Nov 2026)", () => {
  it("has unique slugs that don't collide with any other post", () => {
    const slugs = ANSWER_POSTS.map((p) => p.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const slug of slugs) assert.equal(ALL_BLOG_POSTS.filter((p) => p.slug === slug).length, 1, slug);
  });

  for (const post of ANSWER_POSTS) {
    it(`${post.slug}: answer first, sourced, linked, in the sitemap`, () => {
      assert.match(post.html, /^<p><strong>Short answer:<\/strong>/, "opens with a short answer");
      const answer = text(post.html.split("</p>")[0]);
      assert.ok(answer.split(/\s+/).length <= 110, `short answer is ${answer.split(/\s+/).length} words`);
      assert.match(post.html, /<h2>Sources<\/h2>\s*<ul>\s*<li><a href="https:\/\//, "has a Sources list");
      for (const href of ["/cerebro", "/pricing", "/check-zip"]) {
        assert.ok(`${post.html}${post.closingHtml}`.includes(`href="${href}"`), `links to ${href}`);
      }
      assert.ok(post.closingHtml?.includes('href="/about-david-moore"'), "links to the author page");
      assert.ok((post.faq?.length ?? 0) >= 3, "has an FAQ");
      assert.ok(post.description.length <= 200, `description is ${post.description.length} chars`);
      assert.ok((post.metaTitle ?? post.title).length <= 80, "title fits");
      assert.ok(post.cluster && getCluster(post.cluster), "has a real pillar");
      assert.ok(BLOG_POST_PHOTOS[post.slug], "has its own header photo");
      assert.ok(INDEXABLE_POSTS.some((p) => p.slug === post.slug), "is indexable (and so in the sitemap)");
      const all = `${post.title} ${post.description} ${post.html} ${JSON.stringify(post.faq)} ${post.closingHtml}`;
      assert.doesNotMatch(all, /Young Professional/i);
      assert.doesNotMatch(all, /guarantee|nobody else can|no one else can compete/i);
    });
  }
});
