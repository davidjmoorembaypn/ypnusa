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
  params: Promise<{ location: string }>;
};

export function generateStaticParams() {
  return LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city").map((profile) => ({
    location: profile.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { location } = await params;
  const profile = getLocalSeoProfile("city", location);
  if (!profile) notFound();

  const path = getLocalSeoPath(profile);
  const title = `Mortgage Broker in ${profile.city}, ${profile.stateCode}`;
  // Lead with the page's first sentence and the next step: the full introduction runs ~300 characters.
  const description = clampDescription(`${firstSentence(profile.introduction)} Connect with a licensed ${profile.city} loan officer.`);

  return {
    title,
    description,
    keywords: [
      `mortgage broker ${profile.city} ${profile.stateCode}`,
      `${profile.city} home loans`,
      `${profile.county} mortgage professional`,
      ...profile.neighborhoods.map((neighborhood) => `${neighborhood} mortgage`),
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

export default async function MortgageBrokerLocationPage({ params }: Props) {
  const { location } = await params;
  const profile = getLocalSeoProfile("city", location);
  if (!profile) notFound();

  return <LocationPage profile={profile} business={getPublicBusinessProfile()} />;
}
