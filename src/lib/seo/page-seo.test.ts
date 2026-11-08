import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DESCRIPTION_MAX, PAGE_SEO, TITLE_MAX, TOPIC_SEO } from "./page-seo";
import { TOPIC_CLUSTERS } from "./clusters";

const ALL = [...Object.entries(PAGE_SEO), ...Object.entries(TOPIC_SEO)];

describe("plan page titles and descriptions", () => {
  it(`keeps every title within ${TITLE_MAX} characters and every description within ${DESCRIPTION_MAX}`, () => {
    for (const [key, seo] of ALL) {
      assert.ok(seo.title.length <= TITLE_MAX, `${key} title is ${seo.title.length} chars`);
      assert.ok(seo.description.length <= DESCRIPTION_MAX, `${key} description is ${seo.description.length} chars`);
    }
  });

  it("says ZIP code, never a bare ZIP", () => {
    for (const [key, seo] of ALL) {
      assert.doesNotMatch(`${seo.title} ${seo.description}`, /\bZIPs?\b(?! [Cc]odes?)/, key);
    }
  });

  it("has an entry for every topic pillar", () => {
    for (const cluster of TOPIC_CLUSTERS) assert.ok(TOPIC_SEO[cluster.slug], cluster.slug);
  });
});
