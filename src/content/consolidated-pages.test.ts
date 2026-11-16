import assert from "node:assert/strict";
import { describe, it } from "node:test";
import consolidated from "./consolidated-pages.json";
import legacy from "./legacy-redirects.json";
import wp from "./wp-import/redirects.json";
import { WP_TOP_PAGES } from "./wp-import";
import { LIBRARY_GUIDES } from "./library-guides";

const CONSOLIDATED = consolidated as Record<string, string>;
const REDIRECT_MAPS = { legacy: legacy as Record<string, string>, wp: wp as Record<string, string> };

describe("consolidated WordPress pages", () => {
  it("are no longer built", () => {
    for (const page of WP_TOP_PAGES) assert.ok(!(`/${page.slug}` in CONSOLIDATED), page.slug);
  });

  it("land on a live page in one hop", () => {
    for (const [source, destination] of Object.entries(CONSOLIDATED)) {
      assert.match(source, /^\/[a-z0-9-]+$/, source);
      assert.ok(destination.startsWith("/") && destination !== source, `${source} -> ${destination}`);
      assert.ok(!(destination in CONSOLIDATED), `${source} chains through ${destination}`);
      for (const [name, map] of Object.entries(REDIRECT_MAPS)) {
        assert.ok(!(destination in map), `${source} chains through ${name} redirect ${destination}`);
        assert.ok(!(source in map) && !(`${source}/` in map), `${source} is also in the ${name} redirects`);
      }
    }
  });

  it("are not the target of another redirect", () => {
    for (const [name, map] of Object.entries(REDIRECT_MAPS)) {
      for (const [source, destination] of Object.entries(map)) {
        const path = destination.length > 1 ? destination.replace(/\/+$/, "") : destination;
        assert.ok(!(path in CONSOLIDATED), `${name}: ${source} -> ${destination} now redirects again`);
      }
    }
  });

  it("are never linked from the guide library", () => {
    for (const guide of LIBRARY_GUIDES) assert.ok(!(guide.href in CONSOLIDATED), guide.href);
  });
});
