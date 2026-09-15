/**
 * Dual-host configuration for YPN USA:
 * - Marketing / WordPress: https://ypnus.com
 * - Product app:           https://app.ypnus.com
 */

export const MARKETING_SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() || "https://ypnus.com";

export const APP_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://app.ypnus.com";

/** WordPress REST base used for live territory / signup APIs. */
export const WP_API_BASE =
  process.env.YPNUS_WP_API_BASE?.trim() || `${MARKETING_SITE_URL}/wp-json/ypnus/v1`;

export function marketingUrl(path = "/"): string {
  if (!path || path === "/") return MARKETING_SITE_URL;
  return `${MARKETING_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function appUrl(path = "/"): string {
  if (!path || path === "/") return APP_SITE_URL;
  return `${APP_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Central Valley CA cities YPN USA local SEO targets, in addition to HQ. */
export const CENTRAL_VALLEY_CITIES = [
  "Fresno",
  "Clovis",
  "Sanger",
  "Kingsburg",
  "Reedley",
  "Dinuba",
] as const;

/** schema.org `areaServed` entries for the Central Valley CA local SEO silo. */
export function centralValleyAreaServed() {
  return CENTRAL_VALLEY_CITIES.map((city) => ({
    "@type": "City" as const,
    name: `${city}, CA`,
  }));
}
