import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { WP_POSTS } from "@/content/wp-import";

/**
 * WordPress migration leftovers that were stripped from every imported post: the "Internal linking
 * map" hub list, static tables of contents, and Rank Math / text breadcrumbs. The app renders its own
 * breadcrumb trail and headings, so these showed up twice, or as raw boilerplate, in the article body.
 */
const ARTIFACTS: [string, RegExp][] = [
  ["internal linking map", /Internal linking map/i],
  ["hub-list boilerplate", /Use these hubs to go deeper/i],
  ["static table of contents", /Table of Contents/i],
  ["Rank Math TOC block", /rank-math-toc/],
  ["custom TOC box", /class="toc-box"/],
  ["Rank Math breadcrumb", /rank-math-breadcrumb|breadcrumb_last/],
  ["WordPress breadcrumb nav", /wp-block-breadcrumbs|<nav class="breadcrumbs"/],
  ["text breadcrumb", /Home<\/a>\s*(?:»|&raquo;|&#187;)/],
];

describe("imported posts are free of WordPress template leftovers", () => {
  it("keeps all posts, with unique slugs", () => {
    assert.equal(WP_POSTS.length, 171);
    assert.equal(new Set(WP_POSTS.map((p) => p.slug)).size, WP_POSTS.length);
  });

  for (const [name, pattern] of ARTIFACTS) {
    it(`has no ${name}`, () => {
      const offenders = WP_POSTS.filter((p) => pattern.test(p.html)).map((p) => p.slug);
      assert.deepEqual(offenders, []);
    });
  }

  it("still has real article content in every post (image-attachment stubs were empty before the cleanup)", () => {
    const STUBS = new Set(["external-image-for-post-5", "external-image-for-post-7"]);
    for (const p of WP_POSTS) {
      if (STUBS.has(p.slug)) {
        assert.equal(p.html, "", `${p.slug} should still be the empty stub it was`);
        continue;
      }
      const text = p.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      assert.ok(text.length > 400, `${p.slug} has only ${text.length} characters of text`);
      assert.ok(/<h2|<p/.test(p.html), p.slug);
    }
  });
});

describe("cleanup leaves the markup balanced", () => {
  /** Unbalanced in the original WordPress export too; not caused by the cleanup. */
  const ALREADY_UNBALANCED = new Set(["the-b2b-real-estate-ecosystem-driving-enterprise-growth-brokerage-scaling-and-institutional-lending"]);
  const balance = (html: string, tag: string) =>
    (html.match(new RegExp(`<${tag}[\\s>]`, "g")) ?? []).length - (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;

  it("has matching open and close tags for div, nav and ul in every post", () => {
    const offenders: string[] = [];
    for (const p of WP_POSTS) {
      if (ALREADY_UNBALANCED.has(p.slug)) continue;
      for (const tag of ["div", "nav", "ul"]) if (balance(p.html, tag) !== 0) offenders.push(`${p.slug} <${tag}> ${balance(p.html, tag)}`);
    }
    assert.deepEqual(offenders, []);
  });

  it("keeps the call to action in the post whose Rank Math TOC block was malformed", () => {
    const post = WP_POSTS.find((p) => p.slug === "common-mortgage-lead-problems-and-how-to-fix-them-2");
    assert.ok(post);
    assert.ok(post.html.includes("Stop renting leads"), "call-to-action box was cut");
    assert.ok(post.html.includes("lo-signup.html"), "call-to-action button was cut");
  });
});

describe("IndexNow key file", () => {
  it("is served from /public and contains exactly the key", () => {
    const key = "8ab267adff4f40baa11791fe4126e4b6";
    const body = readFileSync(join(process.cwd(), "public", `${key}.txt`), "utf8");
    assert.equal(body.trim(), key);
  });
});
