import type { MetadataRoute } from "next";
import { INDEXABLE_POSTS, TOPIC_CLUSTERS } from "@/lib/seo/clusters";
import { PROGRAM_LIST } from "@/lib/programs";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { MLO_MARKETS } from "@/content/mlo-markets";
import {
  WP_TOP_PAGES,
  WP_MARKET_PAGES,
  WP_LOAN_TYPE_PAGES,
  WP_VS_PAGES,
  WP_PLATFORM_PAGES,
  WP_FEATURES_SUBPAGES,
  WP_MLO_MARKETING_PAGES,
  WP_TERRITORY_PAGES,
  type WpImportedPage,
} from "@/content/wp-import";

/**
 * Intentionally small sitemap for the product app.
 * Do NOT regenerate tens of thousands of city/ZIP URLs here — that pattern on
 * app.ypnus.com is already flooding Google's "Not indexed" queue.
 *
 * Every URL is on the canonical ypnus.com origin (app.ypnus.com 301s there). It is a
 * constant rather than the request's Host header so the sitemap stays static.
 */
/**
 * Imported WordPress top-level pages that are not landing pages (old portal and
 * invoicing stubs, WP's own sitemap/directory, post-checkout pages) or that duplicate
 * a native page (/terms and /privacy redirect to /terms-of-service and /privacy-policy).
 */
const SITEMAP_EXCLUDED_TOP_SLUGS = new Set([
  "doublescale-booking",
  "doublescale-invoice",
  "doublescale-proposal",
  "doublescale-support-portal",
  "client-portal",
  "welcome",
  "sitemap",
  "site-directory",
  "terms",
  "privacy",
  "thank-you",
  "checkout-cancel",
]);
// Bump this when a legal page's content actually changes, so lastModified
// reflects a real revision date instead of every sitemap regeneration.
// Same rule for marketing pages: a lastmod that changes on every request is ignored by crawlers.
const MARKETING_LAST_MODIFIED = new Date("2026-10-15T00:00:00.000Z");
/** Pages added or rewritten for the Nov 2026 SEO plan (home, /cerebro, /teams, /roi, /loan-officers, pillars, /book). */
const SEO_PLAN_LAST_MODIFIED = new Date("2026-11-08T00:00:00.000Z");
const LEGAL_PAGES_LAST_MODIFIED = new Date("2026-09-13T00:00:00.000Z");

function wpPageEntries(origin: string, sectionPath: string, pages: readonly WpImportedPage[]) {
  return pages.map((page) => ({
    url: `${origin}${sectionPath}/${page.slug}`,
    lastModified: new Date(page.modified),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = MARKETING_SITE_URL;
  return [
    { url: `${origin}/`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/cerebro`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/teams`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/roi`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/features`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/pricing`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/loan-officers`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.9 },
    ...MLO_MARKETS.map((market) => ({
      url: `${origin}/loan-officers/${market.slug}`,
      lastModified: MARKETING_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${origin}/about`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/book`, lastModified: SEO_PLAN_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/claim-territory`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/consultation`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.8 },
    { url: `${origin}/blog`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "weekly", priority: 0.7 },
    { url: `${origin}/mortgage-loans`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.9 },
    { url: `${origin}/embed`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/tools/equity`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/tools/gbp-optimizer`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/tools/social-writer`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    ...PROGRAM_LIST.map((program) => ({
      url: `${origin}/mortgage-loans/${program.toLowerCase()}`,
      lastModified: MARKETING_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // City pages only (a handful, hand-written). ZIP pages stay out on purpose: see the
    // comment above about not flooding Google's "Not indexed" queue.
    ...LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city").map((profile) => ({
      url: `${origin}${getLocalSeoPath(profile)}`,
      lastModified: MARKETING_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    { url: `${origin}/topics`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "weekly", priority: 0.8 },
    ...TOPIC_CLUSTERS.map((cluster) => ({
      url: `${origin}/topics/${cluster.slug}`,
      lastModified: MARKETING_LAST_MODIFIED,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...INDEXABLE_POSTS.map((post) => ({
      url: `${origin}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Migrated from ypnus.com's WordPress (docs/AWS_MIGRATION.md item 1) — real,
    // unique landing-page content, not the programmatic city/ZIP pages the
    // warning above is about.
    ...wpPageEntries(origin, "", WP_TOP_PAGES.filter((page) => !SITEMAP_EXCLUDED_TOP_SLUGS.has(page.slug))),
    ...wpPageEntries(origin, "/markets", WP_MARKET_PAGES),
    ...wpPageEntries(origin, "/loan-types", WP_LOAN_TYPE_PAGES),
    ...wpPageEntries(origin, "/vs", WP_VS_PAGES),
    ...wpPageEntries(origin, "/platform", WP_PLATFORM_PAGES),
    ...wpPageEntries(origin, "/features", WP_FEATURES_SUBPAGES),
    ...wpPageEntries(origin, "/mlo-marketing", WP_MLO_MARKETING_PAGES),
    ...wpPageEntries(origin, "/territory", WP_TERRITORY_PAGES),
    { url: `${origin}/privacy-policy`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/terms-of-service`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/licensing-disclosures`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${origin}/accessibility-statement`, lastModified: LEGAL_PAGES_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
