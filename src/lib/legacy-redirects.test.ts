import assert from "node:assert/strict";
import { describe, it } from "node:test";
import legacy from "../content/legacy-redirects.json";
import wp from "../content/wp-import/redirects.json";

const LEGACY = legacy as Record<string, string>;
const WP = wp as Record<string, string>;

/** Routes the app serves itself; a redirect source here would replace the route. */
const APP_ROUTES = ["/onboarding", "/dashboard", "/login", "/pricing", "/lo", "/embed", "/check-zip", "/loan-officers", "/markets", "/territory", "/vs", "/topics", "/blog", "/features", "/compare"];

describe("legacy Search Console redirects", () => {
  it("never replace a route the app serves", () => {
    for (const source of Object.keys(LEGACY)) {
      assert.ok(!APP_ROUTES.includes(source), `${source} is an app route`);
    }
  });
  it("use clean sources: leading slash, no trailing slash, no query", () => {
    for (const source of Object.keys(LEGACY)) {
      assert.match(source, /^\/[^?#]*[^/]$/, source);
    }
  });
  it("land in one hop", () => {
    for (const [source, destination] of Object.entries(LEGACY)) {
      assert.ok(destination.startsWith("/"), `${source} -> ${destination}`);
      assert.ok(!(destination in LEGACY), `${source} chains through ${destination}`);
      assert.ok(!(destination in WP), `${source} chains through ${destination}`);
      assert.notEqual(source, destination);
    }
  });
  it("do not overlap the WordPress redirect map", () => {
    for (const source of Object.keys(LEGACY)) {
      assert.ok(!(source in WP) && !(`${source}/` in WP), `${source} is also in redirects.json`);
    }
  });
});
