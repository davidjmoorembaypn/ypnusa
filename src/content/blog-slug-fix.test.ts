import { test } from "node:test";
import assert from "node:assert/strict";
import posts from "./wp-import/posts.json";
import legacy from "./legacy-redirects.json";
import wp from "./wp-import/redirects.json";

// Nov 25: the CFPB trigger-lead post moved off a misspelled address. Every old address must land
// on the new one in a single hop.
const NEW = "the-end-of-traditional-mortgage-lead-models";
const OLD = "the-end-of-trafitiona-mortgage-leads-models-ypn-usa";

test("the trigger-lead post lives at its corrected address", () => {
  const slugs = (posts as { slug: string }[]).map((p) => p.slug);
  assert.ok(slugs.includes(NEW));
  assert.ok(!slugs.includes(OLD));
  assert.ok(!JSON.stringify(posts).includes("trafitiona"));
});

test("old addresses of the trigger-lead post redirect straight to the new one", () => {
  const map = { ...(wp as Record<string, string>), ...(legacy as Record<string, string>) };
  for (const source of [`/blog/${OLD}`, `/${OLD}`, "/the-end-of-traditional-mortgage-leads-models"]) {
    assert.equal(map[source], `/blog/${NEW}`, source);
  }
});
