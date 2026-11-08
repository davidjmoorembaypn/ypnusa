import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { HERO_POSTER_SRCSET, HERO_POSTER_URL, pickHeroVideoSource } from "./hero-video";

describe("hero video renditions", () => {
  it("serves the small file to phones, the mid file to tablets and the 1080p file to desktops", () => {
    assert.equal(pickHeroVideoSource(390).label, "mobile");
    assert.equal(pickHeroVideoSource(640).label, "mobile");
    assert.equal(pickHeroVideoSource(820).label, "tablet");
    assert.equal(pickHeroVideoSource(1280).label, "tablet");
    assert.equal(pickHeroVideoSource(1440).label, "desktop");
  });

  it("points at the exact video files the live WordPress homepage uses today", () => {
    assert.equal(
      pickHeroVideoSource(1920).url,
      "https://ypnus.com/wp-content/uploads/2026/10/hero-video-1080-opt.mp4",
    );
  });

  it("serves the poster from this app, and every rendition exists on disk", () => {
    assert.ok(HERO_POSTER_URL.startsWith("/assets/hero/"));
    const urls = [HERO_POSTER_URL, ...HERO_POSTER_SRCSET.split(", ").map((c) => c.split(" ")[0])];
    for (const url of urls) {
      assert.ok(existsSync(path.join(process.cwd(), "public", url)), `${url} is missing from public/`);
    }
  });
});
