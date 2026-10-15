import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/lib/request-host";

// Host-aware for the same reason as sitemap.ts: ypnus.com and app.ypnus.com
// serve the same deployment, so robots.txt must self-identify as whichever
// host actually served the request.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await getSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep product/telemetry surfaces out of the marketing crawl budget.
      disallow: ["/api/", "/analytics", "/dashboard/", "/embed/"],
    },
    sitemap: [`${origin}/sitemap.xml`, `${origin}/local-seo-sitemap.xml`],
    host: origin,
  };
}
