import type { Metadata } from "next";
import { MloMarketPage } from "@/components/mlo-market/mlo-market-page";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "AI Assistant & Exclusive Mortgage Leads for Loan Officers",
    description:
      "Cerebro, the agentic AI assistant for mortgage loan officers, answers and qualifies your borrowers 24/7 inside a protected ZIP you own. Plans from $99 with a 15-day free trial.",
    path: "/loan-officers",
    origin,
  });
}

export default async function LoanOfficersHubPage() {
  const origin = await getSiteOrigin();
  return <MloMarketPage origin={origin} />;
}
