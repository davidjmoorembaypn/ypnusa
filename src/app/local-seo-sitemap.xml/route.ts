import {
  LOCAL_SEO_PROFILES,
  LOCAL_SEO_PUBLIC_ORIGIN,
  getLocalSeoPath,
} from "@/lib/local-seo";

export const dynamic = "force-static";

/**
 * City pages only, matching src/app/sitemap.ts: ZIP pages stay out of every
 * sitemap on purpose (see the comment there about not flooding Google's
 * "Not indexed" queue with programmatic ZIP URLs).
 */
export function GET() {
  const urls = LOCAL_SEO_PROFILES.filter((profile) => profile.kind === "city")
    .map(
      (profile) =>
        `<url><loc>${LOCAL_SEO_PUBLIC_ORIGIN}${getLocalSeoPath(profile)}</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
