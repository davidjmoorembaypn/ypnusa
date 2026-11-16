import type { Metadata } from "next";
import {
  MarketReportHub,
  REPORT_HUB_DESCRIPTION,
  REPORT_HUB_PATH,
  REPORT_HUB_TITLE,
} from "@/components/market-report/market-report-page";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({
    title: REPORT_HUB_TITLE,
    description: REPORT_HUB_DESCRIPTION,
    path: REPORT_HUB_PATH,
    absoluteTitle: true,
    origin: MARKETING_SITE_URL,
  });
}

export default function MarketReportHubPage() {
  return <MarketReportHub origin={MARKETING_SITE_URL} />;
}
