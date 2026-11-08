import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MloMarketPage } from "@/components/mlo-market/mlo-market-page";
import { MLO_MARKETS, getMloMarket } from "@/content/mlo-markets";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return MLO_MARKETS.map((market) => ({ market: market.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ market: string }> }): Promise<Metadata> {
  const { market: slug } = await params;
  const market = getMloMarket(slug);
  if (!market) notFound();
  const origin = MARKETING_SITE_URL;
  return marketingMetadata({
    title: market.title,
    description: market.description,
    path: `/loan-officers/${market.slug}`,
    absoluteTitle: true,
    origin,
  });
}

export default async function LoanOfficerMarketPage({ params }: { params: Promise<{ market: string }> }) {
  const { market: slug } = await params;
  const market = getMloMarket(slug);
  if (!market) notFound();
  const origin = MARKETING_SITE_URL;
  return <MloMarketPage market={market} origin={origin} />;
}
