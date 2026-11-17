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

/**
 * Phones get their own poster: a 360x720 portrait crop of the centre of the 16:9 frame
 * (~25 KB). On a phone the hero is far taller than it is wide, so object-cover only
 * ever showed that centre strip of the wide poster, while the browser still downloaded
 * the ~63 KB 1024w landscape file for it. Same look, less than half the bytes, so the
 * page's Largest Contentful Paint arrives sooner on mobile.
 */
export const HERO_PHONE_POSTER_URL = "/assets/hero/hero-poster-v1-phone-360.webp";
export const HERO_PHONE_POSTER_SIZE = { width: 360, height: 720 } as const;

/** Viewports at or below this width are phones: phone poster, no video. */
export const HERO_PHONE_MAX_WIDTH = 640;
export const HERO_PHONE_MEDIA = `(max-width: ${HERO_PHONE_MAX_WIDTH}px)`;
export const HERO_WIDE_MEDIA = `(min-width: ${HERO_PHONE_MAX_WIDTH + 1}px)`;

/** Widths at or below this get the poster only (phones). */
export const HERO_VIDEO_MIN_WIDTH = HERO_PHONE_MAX_WIDTH + 1;

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
