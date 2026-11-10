import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { HERO_POSTER_SRCSET, HERO_POSTER_URL, pickHeroVideoSource } from "./hero-video";

const onDisk = (url: string) => existsSync(path.join(process.cwd(), "public", url));

describe("hero video renditions", () => {
  it("gives phones the poster only, tablets the 720p file and desktops the 1080p file", () => {
    assert.equal(pickHeroVideoSource(390), null);
    assert.equal(pickHeroVideoSource(640), null);
    assert.equal(pickHeroVideoSource(820)?.label, "tablet");
    assert.equal(pickHeroVideoSource(1280)?.label, "tablet");
    assert.equal(pickHeroVideoSource(1440)?.label, "desktop");
  });

  it("serves every video rendition from this app, and each exists on disk", () => {
    for (const width of [820, 1440]) {
      const url = pickHeroVideoSource(width)?.url ?? "";
      assert.ok(url.startsWith("/assets/hero/"), url);
      assert.ok(onDisk(url), `${url} is missing from public/`);
    }
  });

  it("serves the poster from this app, and every rendition exists on disk", () => {
    assert.ok(HERO_POSTER_URL.startsWith("/assets/hero/"));
    const urls = [HERO_POSTER_URL, ...HERO_POSTER_SRCSET.split(", ").map((c) => c.split(" ")[0])];
    for (const url of urls) assert.ok(onDisk(url), `${url} is missing from public/`);
  });
});
