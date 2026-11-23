import type { MetadataRoute } from "next";
import { INDEXABLE_POSTS, TOPIC_CLUSTERS } from "@/lib/seo/clusters";
import { PROGRAM_LIST } from "@/lib/programs";
import { LOCAL_SEO_PROFILES, getLocalSeoPath } from "@/lib/local-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { MLO_MARKETS } from "@/content/mlo-markets";
import { REPORT_COUNTIES } from "@/content/market-report";
import { METRO_MARKETS, metroPath } from "@/content/metro-markets";
import { METRO_DATA_FETCHED_ON } from "@/content/metro-markets-data";
import { RATE_SHEET_LINKS_CHECKED_ON } from "@/content/rate-sheet-directory";
import { indexableZips, zipCanonicalUrl } from "@/lib/zip-index";
import { COMPARE_PAGES } from "@/content/compare-pages";
import { REPORT_PATH, REPORT_PUBLISHED } from "@/lib/demand-report";
import {
  BANK_STATEMENT_PATH,
  SELF_EMPLOYED_HUB_PATH,
  SELF_EMPLOYED_LAST_MODIFIED,
  SELF_EMPLOYED_COUNTY_ANGLES,
  selfEmployedCountyPath,
} from "@/content/self-employed-loans";
import { COMPARISON_GUIDES, COMPARISON_GUIDES_LAST_MODIFIED } from "@/content/comparison-guides";
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

/** Rebuilt hourly so a newly claimed ZIP code's page joins the sitemap (and a released one leaves). */
export const revalidate = 3600;

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
/** Loan Officer Market Report (HMDA county data), first published Nov 2026. */
const MARKET_REPORT_LAST_MODIFIED = new Date("2026-11-16T00:00:00.000Z");
const LEGAL_PAGES_LAST_MODIFIED = new Date("2026-09-13T00:00:00.000Z");
/** Loan officer text opt-in page, added Nov 23 2026. */
const SMS_OPT_IN_LAST_MODIFIED = new Date("2026-11-23T00:00:00.000Z");

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
    { url: `${origin}/research`, lastModified: MARKET_REPORT_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.8 },
    ...REPORT_COUNTIES.map((county) => ({
      url: `${origin}/research/${county.slug}`,
      lastModified: MARKET_REPORT_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // "Best X" / "X alternatives" comparison guides (src/content/comparison-guides.ts).
    ...COMPARISON_GUIDES.map((guide) => ({
      url: `${origin}${guide.path}`,
      lastModified: new Date(`${COMPARISON_GUIDES_LAST_MODIFIED}T00:00:00.000Z`),
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
    // Three head-to-head comparison pages and the quarterly demand report: the only editorial URLs added Nov 19, 2026.
    ...COMPARE_PAGES.map((page) => ({
      url: `${origin}${page.path}`,
      lastModified: new Date(`${page.dateModified}T00:00:00.000Z`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${origin}${REPORT_PATH}`, lastModified: new Date(`${REPORT_PUBLISHED}T00:00:00.000Z`), changeFrequency: "monthly", priority: 0.7 },
    { url: `${origin}/teams/territory-audit`, lastModified: MARKETING_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.6 },
    { url: `${origin}/rate-sheets`, lastModified: new Date(`${RATE_SHEET_LINKS_CHECKED_ON}T00:00:00.000Z`), changeFrequency: "monthly", priority: 0.6 },
    ...PROGRAM_LIST.map((program) => ({
      url: `${origin}/mortgage-loans/${program.toLowerCase()}`,
      lastModified: program === "DSCR" ? new Date(`${SELF_EMPLOYED_LAST_MODIFIED}T00:00:00.000Z`) : MARKETING_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Self-employed and investor borrower pages (src/content/self-employed-loans.ts). The DSCR
    // page above was rewritten the same day, so it shares this lastmod.
    ...[BANK_STATEMENT_PATH, SELF_EMPLOYED_HUB_PATH, ...REPORT_COUNTIES.filter((c) => SELF_EMPLOYED_COUNTY_ANGLES[c.slug]).map(selfEmployedCountyPath)].map((path) => ({
      url: `${origin}${path}`,
      lastModified: new Date(`${SELF_EMPLOYED_LAST_MODIFIED}T00:00:00.000Z`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    // City pages (a handful, hand-written), then ZIP pages that pass the indexation gate in
    // src/lib/zip-index.ts: 15 flagship ZIP codes, hand-written profiles and ZIP codes a paying loan
    // officer holds. Every other ZIP page is noindex and stays out, per the warning above.
    ...indexableZips().map((zip) => ({
      // Built by the same function as the page's canonical, so the two can never differ.
      url: zipCanonicalUrl(zip),
      lastModified: SEO_PLAN_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
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
    // Big-city market data pages (HMDA 2024), rebuilt Nov 2026 to replace the lost WordPress hubs.
    ...METRO_MARKETS.map((m) => ({
      url: `${origin}${metroPath(m)}`,
      lastModified: new Date(METRO_DATA_FETCHED_ON),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
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
    { url: `${origin}/sms-opt-in`, lastModified: SMS_OPT_IN_LAST_MODIFIED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
