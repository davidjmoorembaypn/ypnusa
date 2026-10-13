import type { MetadataRoute } from "next";
import { APP_SITE_URL } from "@/lib/site";
import { BLOG_POSTS } from "@/content/blog";

const LEGAL_PAGES_LAST_MODIFIED = new Date("2026-09-13T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${APP_SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_SITE_URL}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_SITE_URL}/features/marketing-companion`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${APP_SITE_URL}/features/gmb-optimizer`, lastModified: now, changeFrequency: "monthly", priority: 0.85 },
    { url: `${APP_SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_SITE_URL}/zipwp`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${APP_SITE_URL}/books`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_SITE_URL}/resources`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${APP_SITE_URL}/tools/backlink-generator`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
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
