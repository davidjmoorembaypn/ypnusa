import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SelfEmployedCountyPage, countyPageTitle } from "@/components/self-employed/self-employed-pages";
import { REPORT_COUNTIES } from "@/content/market-report";
import { countyShortAnswer, getSelfEmployedCounty, selfEmployedCountyPath } from "@/content/self-employed-loans";
import { marketingMetadata } from "@/lib/seo";

type Props = { params: Promise<{ county: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return REPORT_COUNTIES.filter((county) => getSelfEmployedCounty(county.slug)).map((county) => ({ county: county.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county: slug } = await params;
  const match = getSelfEmployedCounty(slug);
  if (!match) notFound();
  return {
    ...marketingMetadata({
      title: countyPageTitle(match.county),
      description: countyShortAnswer(match.county),
      path: selfEmployedCountyPath(match.county),
    }),
    robots: { index: true, follow: true },
  };
}

export default async function SelfEmployedCountyRoute({ params }: Props) {
  const { county: slug } = await params;
  const match = getSelfEmployedCounty(slug);
  if (!match) notFound();
  return <SelfEmployedCountyPage county={match.county} angle={match.angle} />;
}
