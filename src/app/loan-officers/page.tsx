import type { Metadata } from "next";
import { MloMarketPage } from "@/components/mlo-market/mlo-market-page";
import { marketingMetadata } from "@/lib/seo";
import { PAGE_SEO } from "@/lib/seo/page-seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({ ...PAGE_SEO.loanOfficers, absoluteTitle: true, path: "/loan-officers" });
}

export default async function LoanOfficersHubPage() {
  return <MloMarketPage origin={MARKETING_SITE_URL} />;
}
