import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { METRO_AREAS, getMetroArea, isMetroAreaIndexable, metroAreaDescription, metroAreaPath, metroAreaTitle } from "@/content/metro-areas";
import { MetroAreaPage } from "@/components/metro-area/metro-area-page";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return METRO_AREAS.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const metro = getMetroArea(slug);
  if (!metro) notFound();
  const meta = marketingMetadata({
    title: metroAreaTitle(metro),
    description: metroAreaDescription(metro),
    path: metroAreaPath(metro),
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
  // Only pages that pass the uniqueness check in src/content/metro-areas.ts are indexable.
  return isMetroAreaIndexable(metro) ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function MetroAreaRoute({ params }: Params) {
  const { slug } = await params;
  const metro = getMetroArea(slug);
  if (!metro) notFound();
  return <MetroAreaPage metro={metro} origin={MARKETING_SITE_URL} />;
}
