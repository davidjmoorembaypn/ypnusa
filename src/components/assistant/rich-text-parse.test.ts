import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseInline, parseRichText, safeHref } from "./rich-text-parse";

describe("assistant rich text", () => {
  it("turns markdown links, bare URLs and bold into structured parts", () => {
    assert.deepEqual(parseInline("See [pricing](https://ypnus.com/pricing) and **lock it**."), [
      { type: "text", text: "See " },
      { type: "link", text: "pricing", href: "https://ypnus.com/pricing" },
      { type: "text", text: " and " },
      { type: "bold", text: "lock it" },
      { type: "text", text: "." },
    ]);
    assert.deepEqual(parseInline("Go to https://ypnus.com/check-zip."), [
      { type: "text", text: "Go to " },
      { type: "link", text: "https://ypnus.com/check-zip", href: "https://ypnus.com/check-zip" },
      { type: "text", text: "." },
    ]);
  });

  it("never makes unsafe links clickable", () => {
    assert.equal(safeHref("javascript:alert(1)"), null);
    assert.equal(safeHref("data:text/html,<b>x</b>"), null);
    assert.equal(safeHref("//evil.example"), null);
    assert.equal(safeHref("/pricing"), "/pricing");
    assert.equal(safeHref("mailto:support@ypnus.com"), "mailto:support@ypnus.com");
    assert.deepEqual(parseInline("[click](javascript:alert(1))")[0].type, "text");
  });

  it("groups bullet and numbered lines into lists and keeps paragraphs", () => {
    const blocks = parseRichText("Here's your plan:\n- Post on GBP\n- Text the lead\n\n1. First\n2. Second");
    assert.equal(blocks.length, 3);
    assert.equal(blocks[0].type, "paragraph");
    assert.deepEqual(blocks[1], {
      type: "list",
      ordered: false,
      items: [[{ type: "text", text: "Post on GBP" }], [{ type: "text", text: "Text the lead" }]],
    });
    assert.equal(blocks[2].type === "list" && blocks[2].ordered, true);
  });

  it("leaves raw HTML as plain text", () => {
    assert.deepEqual(parseRichText("<img src=x onerror=alert(1)>"), [
      { type: "paragraph", lines: [[{ type: "text", text: "<img src=x onerror=alert(1)>" }]] },
    ]);
  });
});
