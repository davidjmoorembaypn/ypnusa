import { test } from "node:test";
import assert from "node:assert/strict";
import {
  META_DESCRIPTION_MAX,
  bestDescription,
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
