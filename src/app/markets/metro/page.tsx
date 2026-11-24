import type { Metadata } from "next";
import { MetroAreaHub } from "@/components/metro-area/metro-area-hub";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { METRO_AREA_HUB_PATH, METRO_AREA_YEAR } from "@/content/metro-areas";

export function generateMetadata(): Metadata {
  return marketingMetadata({
    title: `Top 100 Metro Mortgage Markets ${METRO_AREA_YEAR} | YPN USA`,
    description: `Loan counts, average loan size, purchase share, FHA and VA share and denial rates for the 100 busiest US metro mortgage markets, from ${METRO_AREA_YEAR} HMDA data.`,
    path: METRO_AREA_HUB_PATH,
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

export default function MetroAreaHubRoute() {
  return <MetroAreaHub />;
}
