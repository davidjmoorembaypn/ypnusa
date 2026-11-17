import { test } from "node:test";
import assert from "node:assert/strict";
import { INDEXABLE_POSTS } from "@/lib/seo/clusters";
import { BLOG_PHOTO_KEYS, BLOG_POST_PHOTOS, blogBodyHtml, blogImageFor } from "@/lib/blog-images";

test("every indexable blog post has its own header photo", () => {
  const missing = INDEXABLE_POSTS.filter((post) => !BLOG_POST_PHOTOS[post.slug]).map((post) => post.slug);
  assert.deepEqual(missing, []);
  const keys = INDEXABLE_POSTS.map((post) => BLOG_POST_PHOTOS[post.slug]);
  assert.equal(new Set(keys).size, keys.length, "two posts share a photo");
});

test("photo entries are Unsplash ids with alt text, and every mapped photo exists", () => {
  for (const key of BLOG_PHOTO_KEYS) {
    assert.match(key, /^photo-[0-9]+-[0-9a-f]+$/);
    const image = blogImageFor(Object.keys(BLOG_POST_PHOTOS).find((slug) => BLOG_POST_PHOTOS[slug] === key) ?? "");
    assert.ok(image?.alt.trim(), `${key} has no alt text`);
  }
  for (const key of Object.values(BLOG_POST_PHOTOS)) assert.ok(BLOG_PHOTO_KEYS.includes(key), `${key} is not in photos.json`);
});

test("a post without its own entry still gets a stable photo", () => {
  const a = blogImageFor("a-post-added-later");
  assert.ok(a);
  assert.equal(blogImageFor("a-post-added-later")?.src, a.src);
  assert.match(a.ogUrl, /^https:\/\/.+-og\.jpg$/);
});

test("with a header photo, the repeated stock photo is dropped and body images load lazily", () => {
  const html =
    '<p>Intro</p><figure><img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200" alt="x"></figure>' +
    '<p><img src="https://unsplash.com" alt="y"></p><p><img src="/media/uploads/2026/08/a.jpg" alt="z"></p>';
  const out = blogBodyHtml(html, true);
  assert.doesNotMatch(out, /photo-1560518883|unsplash\.com"/);
  assert.doesNotMatch(out, /<figure>\s*<\/figure>/);
  assert.match(out, /<img[^>]*loading="lazy"[^>]*a\.jpg/);
  assert.match(blogBodyHtml(html, false), /photo-1560518883/);
});
