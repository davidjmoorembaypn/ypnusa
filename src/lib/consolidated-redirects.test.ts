import assert from "node:assert/strict";
import { describe, it, before } from "node:test";
import config from "../../next.config";
import consolidated from "@/content/august-batch-redirects.json";
import legacy from "@/content/legacy-redirects.json";
import wp from "@/content/wp-import/redirects.json";
import { ALL_BLOG_POSTS } from "@/content/blog-all";
import { INDEXABLE_POSTS } from "@/lib/seo/clusters";

/**
 * The real redirect list from next.config.ts, followed hop by hop the way Next matches it
 * (first matching rule wins). Checks that every URL that used to reach one of the 74 consolidated
 * posts (src/content/august-batch-consolidation.ts) now gets to the final /blog/<target> page in
 * ONE redirect, with no stop at /blog/<old-slug>.
 */
type Redirect = { source: string; destination: string; permanent: boolean };

const TARGETS = consolidated as Record<string, string>;
const SLUGS = Object.keys(TARGETS);
const LEGACY = legacy as Record<string, string>;
const WP = wp as Record<string, string>;

/** next.config source pattern -> RegExp. Handles the pattern forms used in this repo. */
function toRegExp(source: string): RegExp {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    let m: RegExpExecArray | null;
    if (rest.startsWith("{/}?")) {
      out += "/?";
      i += 4;
    } else if ((m = /^:(\w+)\(((?:[^()\\]|\\.)*)\)/.exec(rest))) {
      out += `(?<${m[1]}>${m[2]})`;
      i += m[0].length;
    } else if ((m = /^:(\w+)\*/.exec(rest))) {
      out += `(?<${m[1]}>.*)`;
      i += m[0].length;
    } else if ((m = /^:(\w+)\+/.exec(rest))) {
      out += `(?<${m[1]}>.+)`;
      i += m[0].length;
    } else if ((m = /^:(\w+)/.exec(rest))) {
      out += `(?<${m[1]}>[^/]+)`;
      i += m[0].length;
    } else {
      out += source[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      i++;
    }
  }
  return new RegExp(`^${out}$`);
}

let rules: { redirect: Redirect; pattern: RegExp }[] = [];
let all: Redirect[] = [];

function hop(path: string): Redirect | undefined {
  for (const { redirect, pattern } of rules) {
    const match = pattern.exec(path);
    if (match) {
      const destination = redirect.destination.replace(/:(\w+)[*+]?/g, (_, name: string) => match.groups?.[name] ?? "");
      return { ...redirect, destination };
    }
  }
  return undefined;
}

/** Every address visited, starting with `path`; stops at a page (no matching rule). */
function follow(path: string): string[] {
  const trail = [path];
  for (let i = 0; i < 8; i++) {
    const next = hop(trail[trail.length - 1]);
    if (!next) break;
    trail.push(next.destination);
  }
  return trail;
}

const bare = (path: string) => path.replace(/\/+$/, "");

describe("consolidated posts redirect in a single hop", () => {
  before(async () => {
    all = (await config.redirects!()) as Redirect[];
    rules = all.map((redirect) => ({ redirect, pattern: toRegExp(redirect.source) }));
  });

  it("builds the redirect list", () => {
    assert.ok(all.length > 500, `only ${all.length} redirects`);
    assert.equal(SLUGS.length, 74);
  });

  it("sends /blog/<old-slug> straight to /blog/<target>", () => {
    for (const slug of SLUGS) {
      for (const path of [`/blog/${slug}`, `/blog/${slug}/`]) {
        assert.deepEqual(follow(path), [path, `/blog/${TARGETS[slug]}`], path);
      }
    }
  });

  it("sends the old WordPress root address /<old-slug> straight to /blog/<target> (one hop, not two)", () => {
    for (const slug of SLUGS) {
      for (const path of [`/${slug}`, `/${slug}/`]) {
        const trail = follow(path);
        assert.deepEqual(trail, [path, `/blog/${TARGETS[slug]}`], `${path} took ${trail.length - 1} hops: ${trail.join(" -> ")}`);
      }
    }
  });

  it("sends every older WordPress / legacy address that pointed at a consolidated post straight to its target", () => {
    let checked = 0;
    for (const [source, destination] of [...Object.entries(WP), ...Object.entries(LEGACY)]) {
      const slug = destination.startsWith("/blog/") ? destination.slice("/blog/".length) : undefined;
      if (!slug || !TARGETS[slug]) continue;
      const trail = follow(bare(source));
      assert.deepEqual(trail.slice(-1), [`/blog/${TARGETS[slug]}`], `${source} does not end on the target: ${trail.join(" -> ")}`);
      assert.equal(trail.length - 1, 1, `${source} took ${trail.length - 1} hops: ${trail.join(" -> ")}`);
      checked++;
    }
    assert.ok(checked >= 80, `only ${checked} older addresses were checked`);
  });

  it("leaves no redirect anywhere that lands on a consolidated /blog/<old-slug> page", () => {
    const stale = all.filter((r) => {
      const slug = /^\/blog\/([^/?#]+)/.exec(r.destination)?.[1];
      return slug !== undefined && TARGETS[slug] !== undefined;
    });
    assert.deepEqual(stale.map((r) => `${r.source} -> ${r.destination}`), []);
  });

  it("ends on pages that exist, are indexable and do not redirect again", () => {
    const published = new Set(ALL_BLOG_POSTS.map((p) => p.slug));
    const indexable = new Set(INDEXABLE_POSTS.map((p) => p.slug));
    for (const target of new Set(Object.values(TARGETS))) {
      assert.ok(published.has(target), `${target} is not a post`);
      assert.ok(indexable.has(target), `${target} is not indexable, so it would not be served or listed`);
      assert.equal(hop(`/blog/${target}`), undefined, `${target} redirects again`);
    }
  });

  it("does not change redirects that never involved a consolidated post", () => {
    // Targets are real pages: no rule touches them.
    assert.deepEqual(follow("/blog/speed-to-lead-for-mortgage-loan-officers"), ["/blog/speed-to-lead-for-mortgage-loan-officers"]);
    // A WordPress duplicate that points at a post that was NOT consolidated keeps its destination.
    const keptPost = "how-to-get-mortgage-leads-without-buying-them-a-loan-officers-2026-playbook";
    assert.ok(!TARGETS[keptPost]);
    assert.deepEqual(follow("/how-to-get-mortgage-leads-without-buying-them"), ["/how-to-get-mortgage-leads-without-buying-them", `/blog/${keptPost}`]);
    // Other old addresses keep their own destinations.
    assert.deepEqual(follow("/register"), ["/register", "/login?next=%2Fonboarding"]);
    assert.deepEqual(follow("/terms"), ["/terms", "/terms-of-service"]);
  });
});
