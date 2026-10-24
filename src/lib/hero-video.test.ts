import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HERO_POSTER_URL, pickHeroVideoSource } from "./hero-video";

describe("hero video renditions", () => {
  it("serves the small file to phones, the mid file to tablets and the 1080p file to desktops", () => {
    assert.equal(pickHeroVideoSource(390).label, "mobile");
    assert.equal(pickHeroVideoSource(640).label, "mobile");
    assert.equal(pickHeroVideoSource(820).label, "tablet");
    assert.equal(pickHeroVideoSource(1280).label, "tablet");
    assert.equal(pickHeroVideoSource(1440).label, "desktop");
  });

  it("points at the exact files the live WordPress homepage uses today", () => {
    assert.equal(
      pickHeroVideoSource(1920).url,
      "https://ypnus.com/wp-content/uploads/2026/10/hero-video-1080-opt.mp4",
    );
    assert.equal(HERO_POSTER_URL, "https://ypnus.com/wp-content/uploads/2026/09/hero-poster-1600.webp");
  });
});
