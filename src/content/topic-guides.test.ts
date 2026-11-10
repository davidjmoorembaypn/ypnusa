import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TOPIC_GUIDES } from "./topic-guides";
import { INDEXABLE_POSTS, getCluster } from "@/lib/seo/clusters";

const words = (html: string) => html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

describe("topic pillar intros", () => {
  for (const [slug, sections] of Object.entries(TOPIC_GUIDES)) {
    it(`${slug}: is a real pillar with a 600-900 word intro`, () => {
      assert.ok(getCluster(slug), slug);
      const total = sections.reduce((sum, s) => sum + words(s.heading) + words(s.html), 0);
      assert.ok(total >= 600 && total <= 900, `${slug} intro is ${total} words`);
    });

    it(`${slug}: links only to published posts`, () => {
      const slugs = new Set(INDEXABLE_POSTS.map((p) => p.slug));
      for (const section of sections) {
        for (const [, post] of section.html.matchAll(/href="\/blog\/([^"#?]+)"/g)) {
          assert.ok(slugs.has(post), `${slug} links to missing post ${post}`);
        }
      }
    });

    it(`${slug}: links home to /claim-territory`, () => {
      assert.ok(sections.some((s) => s.html.includes('href="/claim-territory"')));
    });
  }
});
