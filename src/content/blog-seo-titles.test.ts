import assert from "node:assert/strict";
import test from "node:test";
import { ALL_BLOG_POSTS, getAnyBlogPost } from "@/content/blog-all";
import { BLOG_SEO_TITLES } from "@/content/blog-seo-titles";

test("every short search title belongs to a live post and fits Google's results page", () => {
  for (const [slug, title] of Object.entries(BLOG_SEO_TITLES)) {
    assert.ok(getAnyBlogPost(slug), `no post ${slug}`);
    assert.ok(title.length <= 60, `${slug}: ${title.length} chars`);
    assert.doesNotMatch(title, /\bZIP\b(?! [Cc]ode)/, `${slug}: say "ZIP code"`);
  }
});

test("posts get the short title only when they have none of their own; the headline is unchanged", () => {
  const post = ALL_BLOG_POSTS.find((p) => p.slug === "exclusive-zip-territory-vs-shared-mortgage-leads");
  assert.ok(post);
  assert.equal(post.metaTitle, BLOG_SEO_TITLES["exclusive-zip-territory-vs-shared-mortgage-leads"]);
  assert.match(post.title, /Exclusive ZIP Code Territory vs Shared Mortgage Leads/);
});

test("no live blog post is left with a search title over 70 characters", () => {
  const tooLong = ALL_BLOG_POSTS.filter((p) => (p.metaTitle ?? p.title).length > 70).map((p) => p.slug);
  assert.deepEqual(tooLong, []);
});
