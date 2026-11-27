import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LifeEventGuidePage } from "@/components/life-event-guide-page";
import { LIFE_EVENT_GUIDES, lifeEventGuidePath } from "@/content/life-event-mortgages";
import { marketingMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LIFE_EVENT_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = LIFE_EVENT_GUIDES.find((item) => item.slug === slug);
  if (!guide) notFound();
  return {
    ...marketingMetadata({ title: guide.metaTitle, description: guide.description, path: lifeEventGuidePath(guide) }),
    robots: { index: true, follow: true },
  };
}

export default async function LifeEventGuideRoute({ params }: Props) {
  const { slug } = await params;
  const guide = LIFE_EVENT_GUIDES.find((item) => item.slug === slug);
  if (!guide) notFound();
  return <LifeEventGuidePage guide={guide} />;
}
