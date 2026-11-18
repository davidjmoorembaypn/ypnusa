import type { Metadata } from "next";
import { WP_MARKET_PAGES } from "@/content/wp-import";
import { makeWpSectionRoute } from "@/lib/wp-page-route";
import { METRO_MARKETS, getMetroMarket, metroDescription, metroPath, metroTitle } from "@/content/metro-markets";
import { MetroMarketPage } from "@/components/metro-market/metro-market-page";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

// /markets/<slug> serves two kinds of page: the big-city market data pages
// (src/content/metro-markets.ts) and the city pages migrated from WordPress.
const wp = makeWpSectionRoute(WP_MARKET_PAGES, "/markets");

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return [...METRO_MARKETS.map((m) => ({ slug: m.slug })), ...wp.generateStaticParams()];
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const { slug } = await props.params;
  const metro = getMetroMarket(slug);
  if (!metro) return wp.generateMetadata(props);
  return marketingMetadata({
    title: metroTitle(metro),
    description: metroDescription(metro),
    path: metroPath(metro),
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

export default async function MarketPage(props: Params) {
  const { slug } = await props.params;
  const metro = getMetroMarket(slug);
  if (!metro) return wp.Page(props);
  return <MetroMarketPage market={metro} origin={MARKETING_SITE_URL} />;
}
