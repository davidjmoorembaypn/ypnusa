import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INDEXABLE_POSTS,
  TOPIC_CLUSTERS,
  getClusterPosts,
  getPostCluster,
  getRelatedPosts,
  isThinPost,
} from "./clusters";

describe("topic clusters", () => {
  it("assigns every indexable post to exactly one cluster", () => {
    const seen = new Set<string>();
    for (const cluster of TOPIC_CLUSTERS) {
      for (const post of getClusterPosts(cluster.slug)) {
        assert.ok(!seen.has(post.slug), `${post.slug} in two clusters`);
        seen.add(post.slug);
      }
    }
    assert.equal(seen.size, INDEXABLE_POSTS.length);
  });

  it("gives every cluster enough posts to justify a pillar page", () => {
    for (const cluster of TOPIC_CLUSTERS) {
      assert.ok(getClusterPosts(cluster.slug).length >= 5, `${cluster.slug} is too thin`);
    }
  });

  it("keeps pillar titles and descriptions inside SERP limits", () => {
    for (const c of TOPIC_CLUSTERS) {
      assert.ok(c.title.length <= 60, `${c.slug} title ${c.title.length}`);
      assert.ok(c.description.length <= 160, `${c.slug} description ${c.description.length}`);
    }
  });

  it("excludes thin migrated stubs", () => {
    assert.ok(isThinPost({ slug: "external-image-for-post-5", title: "x", html: "<img/>" }));
    assert.ok(!INDEXABLE_POSTS.some((p) => /^external-image/.test(p.slug)));
  });

  it("returns same-cluster related posts without the post itself", () => {
    const post = INDEXABLE_POSTS[0];
    const cluster = getPostCluster(post.slug);
    assert.ok(cluster);
    const related = getRelatedPosts(post.slug, 4);
    assert.ok(related.length > 0 && related.length <= 4);
    for (const r of related) {
      assert.notEqual(r.slug, post.slug);
      assert.equal(getPostCluster(r.slug)?.slug, cluster.slug);
    }
  });
});
