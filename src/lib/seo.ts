import type { Metadata } from "next";
import { MARKETING_SITE_URL } from "@/lib/site";

const SITE_NAME = "YPN USA";

/** Default social image on the canonical (ypnus.com) origin. */
const SOCIAL_IMAGE = {
  url: `${MARKETING_SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "YPN USA — Exclusive mortgage ZIP territories",
};

export { SOCIAL_IMAGE };

/** The single schema.org @id for the founder's Person node (defined in the root layout's @graph). */
export const FOUNDER_ID = `${MARKETING_SITE_URL}/#person-david-moore`;

/** schema.org priceSpecification for a monthly subscription Offer. */
export function monthlyOfferPriceSpecification(price: number | string) {
  return {
    "@type": "UnitPriceSpecification",
    price: String(price),
    priceCurrency: "USD",
    unitCode: "MON",
    billingDuration: "P1M",
  };
}

/** Base titles longer than this skip the root layout's " | YPN USA" suffix. */
export const BRAND_SUFFIX_MAX_BASE_LENGTH = 55;

/**
 * Metadata `title` for a page under the root "%s | YPN USA" template. When the base
 * title is already long (or already carries the brand), the suffix would push it past
 * ~65 characters and get truncated in search results, so the title is used as-is.
 */
export function pageTitle(title: string, { absolute = false }: { absolute?: boolean } = {}): Metadata["title"] {
  if (absolute || title.length > BRAND_SUFFIX_MAX_BASE_LENGTH || /\bYPN USA\b/.test(title)) {
    return { absolute: title };
  }
  return title;
}

export function socialImageFor(origin: string) {
  return { ...SOCIAL_IMAGE, url: `${origin}/opengraph-image` };
}

/**
 * Per-page metadata for marketing routes. The root layout sets openGraph.url to the
 * homepage, so a page that only sets title/description would be shared with the
 * wrong URL; this keeps canonical, Open Graph and Twitter fields aligned per page.
 *
 * `origin` defaults to the canonical marketing origin (MARKETING_SITE_URL,
 * https://ypnus.com): app.ypnus.com now 301s there, so every canonical/OG URL
 * should name ypnus.com. Pass it as a constant rather than reading request
 * headers, so marketing pages stay static/ISR.
 */
export function marketingMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  origin = MARKETING_SITE_URL,
}: {
  title: string;
  description: string;
  path: string;
  /** Skip the root "%s | YPN USA" title template (use for titles that already carry the brand). */
  absoluteTitle?: boolean;
  /** The origin (protocol + host) that served this request. See doc comment above. */
  origin?: string;
}): Metadata {
  const url = `${origin}${path === "/" ? "" : path}`;
  const resolvedTitle = pageTitle(title, { absolute: absoluteTitle });
  const socialTitle = typeof resolvedTitle === "string" ? `${title} | ${SITE_NAME}` : title;
  const image = socialImageFor(origin);
  return {
    title: resolvedTitle,
    description,
    // Absolute so it's correct regardless of the root layout's (static) metadataBase.
    alternates: { canonical: url },
    openGraph: { type: "website", url, siteName: SITE_NAME, title: socialTitle, description, images: [image] },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [image.url] },
  };
}

/** FAQPage JSON-LD from question/answer pairs that are also rendered visibly on the page. */
export function faqJsonLd(items: ReadonlyArray<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
