import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparePageView } from "@/components/compare/compare-page";
import { COMPARE_PAGES, getComparePage, resolveComparePage } from "@/content/compare-pages";
import { marketingMetadata } from "@/lib/seo";

// Exactly the three pages in src/content/compare-pages.ts. Any other slug is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARE_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getComparePage(slug);
  if (!page) notFound();
  return marketingMetadata({ title: page.title, description: page.description, path: page.path, absoluteTitle: true });
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getComparePage(slug);
  if (!page) notFound();
  return <ComparePageView resolved={resolveComparePage(page)} />;
}
