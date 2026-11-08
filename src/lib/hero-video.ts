/**
 * The homepage hero video. The files live in WordPress's media library
 * (ypnus.com/wp-content/uploads) and are referenced by absolute URL so the same
 * markup works on ypnus.com, app.ypnus.com and preview deployments. The
 * AWS front door keeps /wp-content/ routed to the WordPress origin
 * (see aws/apache/ypnus-com.conf), so these URLs must keep resolving until the
 * videos are rehosted too (WordPress cannot be retired before then).
 */
const UPLOADS = "https://ypnus.com/wp-content/uploads";

/**
 * The poster is served from this app (public/assets/hero, immutable-cached) rather than
 * from WordPress: it is the page's LCP image, and going through the WordPress origin
 * plus the on-demand image optimizer made cold loads slow. Bump the "v1" in the file
 * names if the artwork ever changes (the /assets/ path is cached for a year).
 */
export const HERO_POSTER_SRCSET = [
  "/assets/hero/hero-poster-v1-640.webp 640w",
  "/assets/hero/hero-poster-v1-1024.webp 1024w",
  "/assets/hero/hero-poster-v1-1600.webp 1600w",
].join(", ");
export const HERO_POSTER_URL = "/assets/hero/hero-poster-v1-1600.webp";

export interface HeroVideoSource {
  url: string;
  label: "mobile" | "tablet" | "desktop";
}

/** Smallest rendition that still looks sharp at the viewer's width. */
export function pickHeroVideoSource(viewportWidth: number): HeroVideoSource {
  if (viewportWidth <= 640) {
    return { url: `${UPLOADS}/2026/10/hero-video-mobile-480x854.mp4`, label: "mobile" };
  }
  if (viewportWidth <= 1280) {
    return { url: `${UPLOADS}/2026/10/hero-video-720-opt.mp4`, label: "tablet" };
  }
  return { url: `${UPLOADS}/2026/10/hero-video-1080-opt.mp4`, label: "desktop" };
}
