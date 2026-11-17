import type { Metadata } from "next";
import { ComparisonGuidePage, guidePhoto } from "@/components/comparison-guide/comparison-guide-page";
import { BEST_AI_ASSISTANTS_GUIDE as guide } from "@/content/comparison-guides";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const meta = marketingMetadata({
    title: guide.title,
    description: guide.description,
    path: guide.path,
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
  // Share with the page's own header photo instead of the generic site card.
  const hero = guidePhoto(guide.images.hero);
  const image = { url: `${MARKETING_SITE_URL}${hero.og}`, width: 1200, height: 630, alt: hero.alt };
  return { ...meta, openGraph: { ...meta.openGraph, images: [image] }, twitter: { ...meta.twitter, images: [image.url] } };
}

export default function Page() {
  return <ComparisonGuidePage guide={guide} origin={MARKETING_SITE_URL} />;
}
