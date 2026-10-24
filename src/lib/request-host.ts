import { headers } from "next/headers";
import { APP_SITE_URL, MARKETING_SITE_URL } from "@/lib/site";

const APP_HOST = new URL(APP_SITE_URL).host;
const MARKETING_HOST = new URL(MARKETING_SITE_URL).host;

/**
 * Resolves the correct public origin (https://ypnus.com or https://app.ypnus.com)
 * for the request currently being rendered, by reading the incoming Host header.
 *
 * Both hostnames serve this same Next.js deployment (see docs/AWS_MIGRATION.md —
 * "ypnus.com + www" are extra hostnames on the same ALB/certificate as the app).
 * Canonical URLs, Open Graph URLs, JSON-LD @id/url fields and the sitemap must
 * reflect whichever host actually served the request, or ypnus.com traffic gets
 * served pages that self-declare as app.ypnus.com and search engines canonicalize
 * everything onto the wrong host.
 *
 * Falls back to APP_SITE_URL when the Host header is missing or unrecognized
 * (local dev, previews, health checks) so nothing breaks outside production.
 */
export async function getSiteOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const bareHost = host.split(":")[0]?.toLowerCase() ?? "";

  if (bareHost === MARKETING_HOST || bareHost === `www.${MARKETING_HOST}`) {
    return MARKETING_SITE_URL;
  }
  if (bareHost === APP_HOST) {
    return APP_SITE_URL;
  }
  // Unknown host (localhost, a preview deploy, Hostinger health probes): default
  // to the app origin, which is the existing/previous behavior.
  return APP_SITE_URL;
}
