import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationPage } from "@/components/local-seo/location-page";
import { clampDescription, firstSentence } from "@/lib/seo/meta-description";
import { socialImageFor } from "@/lib/seo";
import {
  LOCAL_SEO_PROFILES,
  LOCAL_SEO_PUBLIC_ORIGIN,
  getLocalSeoPath,
  getLocalSeoProfile,
  getPublicBusinessProfile,
} from "@/lib/local-seo";

type Props = {
  params: Promise<{ zipcode: string }>;
};

export function generateStaticParams() {
  return LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "zip").map((profile) => ({
    zipcode: profile.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zipcode } = await params;
  const profile = getLocalSeoProfile("zip", zipcode);
  if (!profile) notFound();

  const path = getLocalSeoPath(profile);
  const title = `Mortgage Help in ${profile.city}, ${profile.stateCode} ${profile.slug}`;
  // Lead with the page's first sentence and the next step: the full introduction runs ~300 characters.
  const description = clampDescription(`${firstSentence(profile.introduction)} Connect with a licensed loan officer for ZIP code ${profile.slug}.`);

  return {
    title,
    description,
    keywords: [
      `mortgage broker ${profile.slug}`,
      `exclusive mortgage leads ${profile.city} ${profile.slug}`,
      `${profile.city} ${profile.slug} home loans`,
      `mortgage professional ${profile.county}`,
      ...profile.neighborhoods.map((neighborhood) => `${neighborhood} home financing`),
    ],
    alternates: { canonical: `${LOCAL_SEO_PUBLIC_ORIGIN}${path}` },
    openGraph: {
      type: "website",
      url: `${LOCAL_SEO_PUBLIC_ORIGIN}${path}`,
      title,
      description,
      siteName: "YPN USA",
      images: [socialImageFor(LOCAL_SEO_PUBLIC_ORIGIN)],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ZipMortgagePage({ params }: Props) {
  const { zipcode } = await params;
  const profile = getLocalSeoProfile("zip", zipcode);
  if (!profile) notFound();

  return <LocationPage profile={profile} business={getPublicBusinessProfile()} />;
}
