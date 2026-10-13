import type { MetadataRoute } from "next";
import { APP_SITE_URL } from "@/lib/site";
import { BLOG_POSTS } from "@/content/blog";

/**
 * Intentionally small sitemap for the product app.
 * Do NOT regenerate tens of thousands of city/ZIP URLs here — that pattern on
 * app.ypnus.com is already flooding Google's "Not indexed" queue.
 */
// Bump this when a legal page's content actually changes, so lastModified
// reflects a real revision date instead of every sitemap regeneration.
const LEGAL_PAGES_LAST_MODIFIED = new Date("2026-09-13T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_SITE_URL}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_SITE_URL}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...BLOG_POSTS.map((post) => ({
      url: `${APP_SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${APP_SITE_URL}/privacy-policy`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_SITE_URL}/terms-of-service`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_SITE_URL}/licensing-disclosures`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${APP_SITE_URL}/accessibility-statement`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
