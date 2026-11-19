import type { MetadataRoute } from "next";
import { MARKETING_SITE_URL } from "@/lib/site";

// Always the canonical ypnus.com origin (app.ypnus.com 301s there). A constant,
// not request headers, so robots.txt stays static.
export default function robots(): MetadataRoute.Robots {
  const origin = MARKETING_SITE_URL;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep product/telemetry surfaces out of the marketing crawl budget.
      // /wp-admin/ is deliberately NOT disallowed: it answers 410 Gone (src/lib/gone.ts), and a crawler
      // has to be allowed to fetch it to see that the address is permanently removed.
      disallow: ["/api/", "/analytics", "/dashboard/", "/embed/", "/admin/"],
    },
    // No `host`: it is a Yandex-only directive that Googlebot ignores (Search Console flags it).
    sitemap: [`${origin}/sitemap.xml`, `${origin}/local-seo-sitemap.xml`],
  };
}
