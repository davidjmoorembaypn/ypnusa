import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import manifest from "../../app/manifest";

describe("web app manifest", () => {
  const m = manifest();

  it("opens the dashboard full screen", () => {
    assert.equal(m.start_url, "/dashboard");
    assert.equal(m.display, "standalone");
    assert.equal(m.scope, "/");
  });

  it("lists 192 and 512 px icons, including a maskable one", () => {
    const sizes = (m.icons ?? []).map((icon) => icon.sizes);
    assert.ok(sizes.includes("192x192"));
    assert.ok(sizes.includes("512x512"));
    assert.ok((m.icons ?? []).some((icon) => icon.purpose === "maskable"));
  });
});

describe("service worker", () => {
  const sw = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

  it("only handles page navigations and skips API calls", () => {
    assert.match(sw, /request\.mode !== "navigate"/);
    assert.match(sw, /startsWith\("\/api\/"\)/);
  });

  it("shows push alerts and opens only same-site paths on tap", () => {
    assert.match(sw, /addEventListener\("push"/);
    assert.match(sw, /startsWith\("\/"\) && !data\.url\.startsWith\("\/\/"\)/);
  });

  it("caches nothing but the static offline page", () => {
    const added = [...sw.matchAll(/cache\.(?:add|addAll|put)\(/g)];
    assert.equal(added.length, 1, "exactly one cache write");
    assert.match(sw, /cache\.add\(new Request\(OFFLINE_URL/);
    assert.equal(/\/dashboard/.test(sw), false, "never caches dashboard pages");
  });
});
