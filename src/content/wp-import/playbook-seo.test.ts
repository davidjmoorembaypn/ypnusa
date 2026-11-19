import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { faqForSchema } from "@/content/blog";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { INDEXABLE_POSTS } from "@/lib/seo/clusters";
import { faqJsonLd } from "@/lib/seo";

const SLUG = "how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook";
const post = ALL_BLOG_POSTS.find((p) => p.slug === SLUG);

/** Visible text of the body: tags removed, common HTML entities decoded, whitespace collapsed. */
function visibleText(html: string): string {
  const named: Record<string, string> = { mdash: "—", ndash: "–", amp: "&", nbsp: " ", quot: '"', lt: "<", gt: ">" };
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/g, (m, n: string) => named[n] ?? m)
    .replace(/\s+/g, " ");
}

describe("'how to get mortgage leads without buying them' playbook post", () => {
  it("exists and stays indexable", () => {
    assert.ok(post);
    assert.ok(INDEXABLE_POSTS.some((p) => p.slug === SLUG));
  });

  it("has an SEO title Google will not truncate (<= 60 characters) that keeps the topic", () => {
    assert.ok(post?.metaTitle);
    assert.ok(post.metaTitle.length <= 60, `metaTitle is ${post.metaTitle.length} characters`);
    assert.match(post.metaTitle, /mortgage leads without buying/i);
    assert.match(post.metaTitle, /2026/);
  });

  it("emits FAQPage JSON-LD that matches the visible FAQ word for word", () => {
    assert.ok(post);
    const faq = faqForSchema(post);
    assert.equal(faq.length, 4);
    const text = visibleText(post.html);
    assert.ok(text.includes("FAQ: Zero-Budget Lead Generation"), "the FAQ section is visible in the body");
    for (const { q, a } of faq) {
      assert.ok(q.endsWith("?"), q);
      assert.ok(text.includes(q), `question not visible in the post: ${q}`);
      assert.ok(text.includes(a), `answer not visible in the post: ${q}`);
    }
    const ld = faqJsonLd(faq);
    assert.equal(ld["@type"], "FAQPage");
    assert.equal(ld.mainEntity.length, 4);
    assert.ok(ld.mainEntity.every((e) => e["@type"] === "Question" && e.acceptedAnswer["@type"] === "Answer"));
  });

  it("does not render a second FAQ (the schema is for the FAQ already in the body)", () => {
    assert.ok(post);
    assert.equal(post.faq, undefined);
  });
});

describe("faqForSchema", () => {
  it("prefers the rendered faq, then the body FAQ, else nothing", () => {
    assert.deepEqual(faqForSchema({ faq: [{ q: "a?", a: "b" }], schemaFaq: [{ q: "c?", a: "d" }] }), [{ q: "a?", a: "b" }]);
    assert.deepEqual(faqForSchema({ schemaFaq: [{ q: "c?", a: "d" }] }), [{ q: "c?", a: "d" }]);
    assert.deepEqual(faqForSchema({}), []);
  });
});
