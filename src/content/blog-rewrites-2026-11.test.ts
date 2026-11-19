import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { CONSOLIDATED_POST_SLUGS } from "@/content/august-batch-consolidation";
import { LOAN_OFFICER_MARKETING_STRATEGIES as POST, REWRITTEN_POSTS } from "@/content/blog-rewrites-2026-11";
import { WP_POSTS } from "@/content/wp-import";
import { INDEXABLE_POSTS, TOPIC_CLUSTERS } from "@/lib/seo/clusters";

/** Visible text of an HTML fragment: scripts and styles removed, tags stripped. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

describe("rewritten marketing-strategies post", () => {
  it("replaces the imported post at the same URL and stays indexable", () => {
    const same = ALL_BLOG_POSTS.filter((p) => p.slug === POST.slug);
    assert.equal(same.length, 1, "exactly one post with this slug");
    assert.equal(same[0], POST, "the native rewrite wins over the imported post");
    assert.ok(WP_POSTS.some((p) => p.slug === POST.slug), "the imported post it replaces still exists in the import");
    assert.ok(INDEXABLE_POSTS.some((p) => p.slug === POST.slug), "indexable, so it stays in the sitemap");
    assert.ok(!CONSOLIDATED_POST_SLUGS.has(POST.slug));
    assert.deepEqual(REWRITTEN_POSTS.map((p) => p.slug), [POST.slug]);
  });

  it("has none of the junk the imported version showed to readers", () => {
    const text = visibleText(POST.html);
    for (const bad of ['"@context"', '"@graph"', "@type", "production-ready", "Internal linking map", "VA Loan Fresno", "Table of Contents", "Home »", "silo"]) {
      assert.ok(!text.includes(bad), `visible text contains ${bad}`);
    }
    assert.ok(!/\[\d+(?:,\s*\d+)*\]/.test(text), "citation markers like [1, 2, 3]");
    assert.ok(!/<script/i.test(POST.html), "no script tags in the body");
    assert.ok(!/\$\s?29\.99/.test(POST.html), "the retired $29.99 price");
  });

  it("opens with a quotable answer and carries a visible FAQ and sources", () => {
    assert.match(POST.html, /^<p><strong>Short answer:<\/strong>/);
    assert.ok(POST.faq && POST.faq.length >= 4, "at least four FAQ entries");
    for (const item of POST.faq ?? []) {
      assert.ok(item.q.endsWith("?") && item.a.length > 40, item.q);
    }
    const sources = POST.html.slice(POST.html.indexOf("<h2>Sources</h2>"));
    const links = [...sources.matchAll(/<a href="(https:\/\/[^"]+)"[^>]*rel="noopener nofollow"/g)].map((m) => m[1]);
    assert.ok(links.length >= 3, `only ${links.length} sources`);
    for (const url of links) assert.match(url, /^https:\/\/(www\.consumerfinance\.gov|www\.fcc\.gov|docs\.fcc\.gov)\//, url);
  });

  it("keeps the title and description inside SERP limits", () => {
    assert.ok(POST.metaTitle && POST.metaTitle.length <= 60, `metaTitle ${POST.metaTitle?.length}`);
    assert.ok(POST.description.length <= 160, `description ${POST.description.length}`);
    assert.match(POST.description, /loan officer marketing/i);
  });

  it("links only to posts that are published, indexable and not consolidated, and never to itself", () => {
    const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
    const html = [POST.html, ...(POST.faq ?? []).map((f) => f.html ?? "")].join("\n");
    const slugs = [...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.ok(slugs.length >= 8, `only ${slugs.length} internal links`);
    for (const slug of slugs) {
      assert.notEqual(slug, POST.slug, "links to itself");
      assert.ok(!CONSOLIDATED_POST_SLUGS.has(slug), `${slug} is consolidated (it redirects)`);
      assert.ok(indexable.has(slug), `${slug} is not an indexable post`);
    }
  });
});

describe("meta descriptions of imported posts", () => {
  it("do not start with a stray 'n' left by a lost newline", () => {
    const bad = WP_POSTS.filter((p) => /^n\s/.test(p.description)).map((p) => p.slug);
    assert.deepEqual(bad, []);
  });
});

describe("mortgage leads pillar page", () => {
  const cluster = TOPIC_CLUSTERS.find((c) => c.slug === "exclusive-mortgage-leads");

  it("targets 'mortgage leads for loan officers' in the title, description and H1", () => {
    assert.ok(cluster);
    assert.match(cluster.title, /^Mortgage Leads for Loan Officers/);
    assert.match(cluster.description, /mortgage leads for loan officers/i);
    assert.match(cluster.h1, /^Mortgage leads for loan officers/);
  });

  it("answers how loan officers get leads and whether shared leads are worth buying", () => {
    const questions = cluster?.faq.map((f) => f.q) ?? [];
    assert.ok(questions.includes("How do loan officers get mortgage leads?"));
    assert.ok(questions.includes("Are shared mortgage leads worth buying?"));
    assert.ok(questions.length >= 4);
  });
});
