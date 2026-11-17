import photosData from "@/content/blog-images/photos.json";
import postsData from "@/content/blog-images/posts.json";
import { MARKETING_SITE_URL } from "@/lib/site";
import { prepareWpHtml } from "@/lib/wp-html";

/**
 * Header photos for blog posts. Each post maps to one Unsplash photo (Unsplash License: free
 * for commercial use, no attribution required) that is downloaded into public/images/blog by
 * scripts/fetch-blog-images.mjs, so pages never load images from a third party.
 */
interface PhotoEntry {
  alt: string;
  source: string;
  license: string;
}

export interface BlogImage {
  /** 1200x675 WebP header. */
  src: string;
  /** 480x270 WebP thumbnail for post lists. */
  thumb: string;
  /** srcset covering both widths. */
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  /** Absolute 1200x630 JPEG for og:image, twitter:image and JSON-LD. */
  ogUrl: string;
  /** Absolute URL of the 16:9 header, for JSON-LD. */
  url: string;
}

const PHOTOS = photosData as Record<string, PhotoEntry>;
const POSTS = postsData as Record<string, string>;

/**
 * Posts added later without a photo of their own reuse one of the existing photos, picked
 * from the slug so it stays the same between builds. Give a new post its own entry in
 * posts.json (and photos.json) when it ships.
 */
const FALLBACK_KEYS: readonly string[] = Object.values(POSTS).filter((key, i, all) => PHOTOS[key] && all.indexOf(key) === i).slice(0, 12);

function fallbackKey(slug: string): string | undefined {
  if (!FALLBACK_KEYS.length) return undefined;
  let hash = 0;
  for (const ch of slug) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_KEYS[hash % FALLBACK_KEYS.length];
}

export function blogImageFor(slug: string): BlogImage | undefined {
  const key = POSTS[slug] && PHOTOS[POSTS[slug]] ? POSTS[slug] : fallbackKey(slug);
  const photo = key ? PHOTOS[key] : undefined;
  if (!key || !photo) return undefined;
  const src = `/images/blog/${key}.webp`;
  const thumb = `/images/blog/${key}-480.webp`;
  return {
    src,
    thumb,
    srcSet: `${thumb} 480w, ${src} 1200w`,
    width: 1200,
    height: 675,
    alt: photo.alt,
    ogUrl: `${MARKETING_SITE_URL}/images/blog/${key}-og.jpg`,
    url: `${MARKETING_SITE_URL}${src}`,
  };
}

/**
 * Imported WordPress posts repeat one generic stock photo (and a few carry an image with an
 * empty unsplash.com src). With a header photo on every post those add nothing, so they are
 * dropped; every other body image loads lazily since the header is now the first image.
 */
const REPEATED_STOCK_IMAGE = /<img\b[^>]*\bsrc=["'](?:https?:\/\/images\.unsplash\.com\/photo-1560518883-ce09059eeffa[^"']*|https?:\/\/unsplash\.com\/?)["'][^>]*>/gi;

export function blogBodyHtml(html: string, hasHeaderPhoto: boolean): string {
  let out = prepareWpHtml(html, true).html;
  if (!hasHeaderPhoto) return out;
  out = out.replace(REPEATED_STOCK_IMAGE, "");
  out = out.replace(/<(p|figure)\b[^>]*>\s*(?:<figcaption\b[^>]*>[\s\S]*?<\/figcaption>\s*)?<\/\1>/gi, "");
  return out.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy"');
}

/** Every photo key in use, for tests. */
export const BLOG_PHOTO_KEYS: readonly string[] = Object.keys(PHOTOS);
export const BLOG_POST_PHOTOS: Readonly<Record<string, string>> = POSTS;
