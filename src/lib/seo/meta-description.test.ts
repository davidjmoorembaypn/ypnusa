import { test } from "node:test";
import assert from "node:assert/strict";
import {
  META_DESCRIPTION_MAX,
  bestDescription,
  uniqueDescriptions,
  clampDescription,
  firstParagraphText,
  looksLikeCode,
} from "@/lib/seo/meta-description";
import { WP_POSTS, WP_TOP_PAGES, WP_MLO_MARKETING_PAGES } from "@/content/wp-import";

test("clampDescription leaves short text alone", () => {
  assert.equal(clampDescription("Short and sweet."), "Short and sweet.");
});

test("clampDescription cuts at a sentence end when that keeps most of the text", () => {
  const text = `${"a".repeat(120)} done. And then a much longer second sentence that pushes everything past the limit for sure.`;
  const out = clampDescription(text);
  assert.ok(out.length <= META_DESCRIPTION_MAX);
  assert.ok(out.endsWith("done."));
});

test("clampDescription never cuts mid-word and adds an ellipsis", () => {
  const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ");
  const out = clampDescription(words);
  assert.ok(out.length <= META_DESCRIPTION_MAX);
  assert.ok(out.endsWith("…"));
  const lastWord = out.slice(0, -1).split(" ").pop() ?? "";
  assert.match(lastWord, /^word\d+$/);
  assert.ok(words.includes(`${lastWord} `));
});

test("looksLikeCode spots CSS dumped into a description", () => {
  assert.ok(looksLikeCode(".yp-post{max-width:820px;margin:0 auto;font-family:system-ui}"));
  assert.ok(looksLikeCode(".ypn-post h2{font-size:1.35rem;}"));
  assert.ok(!looksLikeCode("Facebook marketing in 2026 isn't old school: it works for loan officers."));
});

test("firstParagraphText skips styles, breadcrumbs and short labels", () => {
  const html =
    "<style>.x{color:red}</style><p>Home » Blog » Post</p><p>Short label</p>" +
    "<p>Busy loan officers do not lack opportunity &mdash; they lack time to follow up with every borrower who asks.</p>";
  assert.equal(
    firstParagraphText(html),
    "Busy loan officers do not lack opportunity — they lack time to follow up with every borrower who asks.",
  );
});

test("bestDescription keeps a good stored description", () => {
  const stored = "Exclusive ZIP code territories for licensed loan officers, with Cerebro answering borrowers around the clock.";
  assert.equal(bestDescription(stored, "<p>ignored</p>"), stored);
});

test("bestDescription replaces CSS, breadcrumbs and slogans with the opening paragraph", () => {
  const body = "<p>Mortgage loan officers who follow up within minutes win more applications than those who wait a day or more.</p>";
  for (const stored of [".yp-post{max-width:820px;margin:0 auto}", "Home » AI Tools » Speed to Lead", "Win more loans fast"]) {
    assert.equal(
      bestDescription(stored, body),
      "Mortgage loan officers who follow up within minutes win more applications than those who wait a day or more.",
    );
  }
});

test("imported posts and pages get real-prose descriptions that fit in search results", () => {
  for (const item of [...WP_POSTS, ...WP_TOP_PAGES, ...WP_MLO_MARKETING_PAGES]) {
    assert.ok(!looksLikeCode(item.description), `${item.slug}: description is code`);
    assert.ok(!/^home\s*[»>]/i.test(item.description), `${item.slug}: description is a breadcrumb`);
    assert.ok(item.description.length <= META_DESCRIPTION_MAX, `${item.slug}: ${item.description.length} chars`);
  }
});

test("bylines and dates are not used as descriptions", () => {
  const html =
    "<p>Updated September 26, 2026 \u00b7 By David J. Moore, MBA, 25-year mortgage loan officer (NMLS #787257)</p>" +
    "<p>Rates in 2026 are expected to stay range-bound, which rewards loan officers who build their own local pipeline.</p>";
  assert.match(bestDescription("Home » Rates", html), /^Rates in 2026/);
});

test("pages that open with the same paragraph get different descriptions", () => {
  const shared = "<p>The traditional model of mortgage loan origination is fundamentally broken for most loan officers.</p>";
  const out = uniqueDescriptions([
    { description: "Home » A", html: `${shared}<p>Post A explains automated pre-approval follow-up for busy mortgage loan officers.</p>` },
    { description: "Home » B", html: `${shared}<p>Post B explains document intake automation so files are complete before underwriting.</p>` },
    { description: "A real description long enough to keep as it is, written for this page alone.", html: shared },
  ]);
  assert.equal(new Set(out).size, 3);
  assert.match(out[0], /^The traditional model/);
  assert.match(out[1], /^Post B/);
  assert.match(out[2], /^A real description/);
});

test("imported posts do not share descriptions", () => {
  const seen = new Map<string, string>();
  for (const post of WP_POSTS) {
    if (/^external-image-for-post/.test(post.slug)) continue;
    assert.ok(!seen.has(post.description), `${post.slug} repeats ${seen.get(post.description)}`);
    seen.set(post.description, post.slug);
  }
});
