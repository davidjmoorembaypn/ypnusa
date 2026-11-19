/**
 * Hosts for YPN USA. The whole site runs on this app at https://ypnus.com (WordPress is retired);
 * app.ypnus.com redirects there.
 */

export const MARKETING_SITE_URL =
  process.env.NEXT_PUBLIC_MARKETING_SITE_URL?.trim() || "https://ypnus.com";

export const APP_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://app.ypnus.com";

/** Stripe customer-portal login (a public link) where Subscribers manage or cancel online. */
export const CUSTOMER_PORTAL_URL =
  process.env.STRIPE_CUSTOMER_PORTAL_URL?.trim() ||
  "https://billing.stripe.com/p/login/7sYcN41NEc3L7i96GG3AY00";

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
