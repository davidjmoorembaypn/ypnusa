import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  MarketReportCounty,
  countyDescription,
  countyTitle,
  reportCountyPath,
} from "@/components/market-report/market-report-page";
import { REPORT_COUNTIES, getReportCounty } from "@/content/market-report";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_COUNTIES.map((county) => ({ county: county.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ county: string }> }): Promise<Metadata> {
  const { county: slug } = await params;
  const county = getReportCounty(slug);
  if (!county) notFound();
  return marketingMetadata({
    title: countyTitle(county),
    description: countyDescription(county),
    path: reportCountyPath(county),
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

export default async function MarketReportCountyPage({ params }: { params: Promise<{ county: string }> }) {
  const { county: slug } = await params;
  const county = getReportCounty(slug);
  if (!county) notFound();
  return <MarketReportCounty county={county} origin={MARKETING_SITE_URL} />;
}
