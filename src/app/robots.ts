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
      disallow: ["/api/", "/analytics", "/dashboard/", "/embed/", "/admin/"],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/local-seo-sitemap.xml`],
    host: origin,
  };
}
