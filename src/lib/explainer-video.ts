import { MARKETING_SITE_URL } from "@/lib/site";

/** David's explainer video (YouTube channel "Investing Success | ToInvested"), published Sep 9, 2026. */
export const EXPLAINER_VIDEO = {
  id: "MdwrE3LjLMA",
  title: "The Only Mortgage Lead Strategy You Need in 2026",
  description:
    "Why loan officers should build owned local lead assets, like an exclusive ZIP code territory with AI follow-up that answers borrowers fast, instead of paying for clicks or shared leads.",
  uploadDate: "2026-09-09",
} as const;

export function explainerVideoJsonLd() {
  const v = EXPLAINER_VIDEO;
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: v.title,
    description: v.description,
    thumbnailUrl: [`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg`],
    uploadDate: v.uploadDate,
    embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}`,
    contentUrl: `https://www.youtube.com/watch?v=${v.id}`,
    publisher: { "@id": `${MARKETING_SITE_URL}/#organization` },
  };
}
