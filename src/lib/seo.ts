import type { Metadata } from "next";
import { APP_SITE_URL } from "@/lib/site";

const SITE_NAME = "YPN USA";
const SOCIAL_IMAGE = {
  url: `${APP_SITE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "YPN USA — Exclusive mortgage ZIP territories",
};

export { SOCIAL_IMAGE };

/**
 * Per-page metadata for marketing routes. The root layout sets openGraph.url to the
 * homepage, so a page that only sets title/description would be shared with the
 * wrong URL; this keeps canonical, Open Graph and Twitter fields aligned per page.
 */
export function marketingMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** Skip the root "%s | YPN USA" title template (use for titles that already carry the brand). */
  absoluteTitle?: boolean;
}): Metadata {
  const url = `${APP_SITE_URL}${path === "/" ? "" : path}`;
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url, siteName: SITE_NAME, title: socialTitle, description, images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: [SOCIAL_IMAGE.url] },
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
