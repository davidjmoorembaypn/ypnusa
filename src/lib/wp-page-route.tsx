import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";
import { getWpPage, type WpImportedPage } from "@/content/wp-import";
import { WpImportedPageView } from "@/components/wp-imported-page";

type Params = { params: Promise<{ slug: string }> };

/**
 * Factory for a [slug] route section backed by WordPress-migrated content
 * (see src/content/wp-import/index.ts). Each app/<section>/[slug]/page.tsx
 * is just:
 *
 *   const route = makeWpSectionRoute(WP_MARKET_PAGES, "/markets", "Markets");
 *   export const generateStaticParams = route.generateStaticParams;
 *   export const generateMetadata = route.generateMetadata;
 *   export default route.Page;
 */
export function makeWpSectionRoute(
  list: readonly WpImportedPage[],
  sectionPath: string,
  breadcrumbLabel: string,
) {
  function generateStaticParams() {
    return list.map((p) => ({ slug: p.slug }));
  }

  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { slug } = await params;
    const page = getWpPage(list, slug);
    if (!page) return {};
    const origin = await getSiteOrigin();
    return marketingMetadata({
      title: page.title,
      description: page.description,
      path: `${sectionPath}/${slug}`,
      origin,
    });
  }

  async function Page({ params }: Params) {
    const { slug } = await params;
    const page = getWpPage(list, slug);
    if (!page) notFound();
    return <WpImportedPageView page={page} path={`${sectionPath}/${slug}`} breadcrumbLabel={breadcrumbLabel} />;
  }

  return { generateStaticParams, generateMetadata, Page };
}
