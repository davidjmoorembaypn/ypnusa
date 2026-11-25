import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LocationPage } from "@/components/local-seo/location-page";
import { ZipMarketPage } from "@/components/local-seo/zip-market-page";
import { FLAGSHIP_ZIPS, flagshipZip } from "@/content/zip-flagship";
import { buildZipLocalIntel } from "@/content/zip-local-intel";
import { clampDescription, firstSentence } from "@/lib/seo/meta-description";
import { socialImageFor } from "@/lib/seo";
import { LOCAL_SEO_PROFILES, getLocalSeoProfile, getPublicBusinessProfile } from "@/lib/local-seo";
import { ZIP_PUBLIC_ORIGIN, isZipIndexable, nearestIndexableZips, zipCanonicalUrl } from "@/lib/zip-index";

type Props = {
  params: Promise<{ zipcode: string }>;
};

/**
 * ISR: prerender the flagship and hand-written ZIP codes, render any other real ZIP code on first
 * request, and refresh hourly so a page turns indexable soon after its ZIP code is claimed (and
 * back to noindex after it is released).
 */
export const revalidate = 3600;

export function generateStaticParams() {
  const zips = new Set<string>([...FLAGSHIP_ZIPS.map((z) => z.zip), ...LOCAL_SEO_PROFILES.filter((p) => p.kind === "zip").map((p) => p.slug)]);
  return [...zips].map((zipcode) => ({ zipcode }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zipcode } = await params;
  const intel = /^\d{5}$/.test(zipcode) ? buildZipLocalIntel(zipcode) : null;
  if (!intel) notFound();

  const profile = getLocalSeoProfile("zip", zipcode);
  const indexable = isZipIndexable(zipcode);
  // Always the bare /zip/<zip> address: no ?zip=, no UTM tags.
  const canonical = zipCanonicalUrl(zipcode);
  const place = intel.city && intel.state ? `${intel.city}, ${intel.state}` : "ZIP code";
  const title = `Mortgage Help in ${place} ${zipcode}`;
  const description = profile
    ? // Lead with the page's first sentence and the next step: the full introduction runs ~300 characters.
      clampDescription(`${firstSentence(profile.introduction)} Connect with a licensed loan officer for ZIP code ${zipcode}.`)
    : clampDescription(
        `Local mortgage facts for ${place} ${zipcode}: loan limits, property tax context and estimated 60-day home-buying activity. Talk to a licensed loan officer.`,
      );

  return {
    title,
    description,
    keywords: [
      `mortgage broker ${zipcode}`,
      `exclusive mortgage leads ${intel.city} ${zipcode}`,
      `${intel.city} ${zipcode} home loans`,
      ...(profile ? [`mortgage professional ${profile.county}`, ...profile.neighborhoods.map((n) => `${n} home financing`)] : []),
    ],
    alternates: { canonical },
    openGraph: {
      type: "website",
      url: canonical,
      title,
      description,
      siteName: "YPN USA",
      images: [socialImageFor(ZIP_PUBLIC_ORIGIN)],
    },
    // The indexation gate (src/lib/zip-index.ts): flagship, hand-written or claimed ZIP codes only.
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function ZipMortgagePage({ params }: Props) {
  const { zipcode } = await params;
  const intel = /^\d{5}$/.test(zipcode) ? buildZipLocalIntel(zipcode) : null;
  // Not five digits, or not a real ZIP code in the bundled data: a 404, never a made-up page.
  if (!intel) notFound();

  const indexable = isZipIndexable(zipcode);
  const neighbors = indexable ? nearestIndexableZips(zipcode, 5) : [];
  const profile = getLocalSeoProfile("zip", zipcode);
  if (profile) {
    return <LocationPage profile={profile} business={getPublicBusinessProfile()} zipIntel={indexable ? { intel, neighbors } : undefined} />;
  }
  const sameCityZip = indexable ? undefined : flagshipZip(zipcode)?.sameCityAs;
  return <ZipMarketPage intel={intel} indexable={indexable} neighbors={neighbors} sameCityZip={sameCityZip} />;
}
