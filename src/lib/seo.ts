import type { Metadata } from "next";
import { APP_SITE_URL } from "@/lib/site";

const SITE_NAME = "YPN USA";

/** Default (app-origin) social image, kept for callers that haven't gone host-aware yet. */
const SOCIAL_IMAGE = {
  url: `${APP_SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "YPN USA — Exclusive mortgage ZIP territories",
};

export { SOCIAL_IMAGE };

export function socialImageFor(origin: string) {
  return { ...SOCIAL_IMAGE, url: `${origin}/opengraph-image` };
}

/**
 * Per-page metadata for marketing routes. The root layout sets openGraph.url to the
 * homepage, so a page that only sets title/description would be shared with the
 * wrong URL; this keeps canonical, Open Graph and Twitter fields aligned per page.
 *
 * `origin` should be the host that actually served the request (see
 * `getSiteOrigin()` in `@/lib/request-host`) so ypnus.com and app.ypnus.com each
 * get canonical/OG URLs pointing at themselves, not at one hardcoded host.
 * Defaults to APP_SITE_URL for call sites that haven't been made host-aware.
 */
export function marketingMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
  origin = APP_SITE_URL,
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
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const image = socialImageFor(origin);
  return {
    title: absoluteTitle ? { absolute: title } : title,
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
