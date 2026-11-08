/**
 * The homepage hero media, all served by this app from public/assets/hero (the
 * /assets/ path is immutable-cached for a year, so bump "v1" in the file names if
 * the artwork changes). Nothing here depends on the old WordPress media library.
 *
 * Poster: the page's Largest Contentful Paint image. A plain <img> with srcset so
 * phones fetch the ~30 KB rendition and skip the on-demand image optimizer.
 *
 * Video: re-encoded from the WordPress originals (no audio, 24 fps, two-pass,
 * faststart) at about half their size: 1080p 2.8 MB, 720p 1.7 MB. Phones get the
 * poster only: a background video there costs about 2 MB on a cellular connection
 * and became the page's LCP element, adding seconds to it.
 */
export const HERO_POSTER_SRCSET = [
  "/assets/hero/hero-poster-v1-640.webp 640w",
  "/assets/hero/hero-poster-v1-1024.webp 1024w",
  "/assets/hero/hero-poster-v1-1600.webp 1600w",
].join(", ");
export const HERO_POSTER_URL = "/assets/hero/hero-poster-v1-1600.webp";

/** Widths at or below this get the poster only (phones). */
export const HERO_VIDEO_MIN_WIDTH = 641;

export interface HeroVideoSource {
  url: string;
  label: "tablet" | "desktop";
}

/**
 * Smallest rendition that still looks sharp at the viewer's width, or null on phones,
 * which keep the poster.
 */
export function pickHeroVideoSource(viewportWidth: number): HeroVideoSource | null {
  if (viewportWidth < HERO_VIDEO_MIN_WIDTH) return null;
  if (viewportWidth <= 1280) return { url: "/assets/hero/hero-video-v1-720.mp4", label: "tablet" };
  return { url: "/assets/hero/hero-video-v1-1080.mp4", label: "desktop" };
}
