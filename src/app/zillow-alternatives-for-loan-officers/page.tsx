import type { Metadata } from "next";
import { ComparisonGuidePage } from "@/components/comparison-guide/comparison-guide-page";
import { ZILLOW_ALTERNATIVES_GUIDE as guide } from "@/content/comparison-guides";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({
    title: guide.title,
    description: guide.description,
    path: guide.path,
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

export default function Page() {
  return <ComparisonGuidePage guide={guide} origin={MARKETING_SITE_URL} />;
}
