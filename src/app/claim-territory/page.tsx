import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { TerritoryClaim } from "@/components/territory-claim";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";
import claimTerritoryContent from "@/content/wp-import/claim-territory.json";

/**
 * Migrated from ypnus.com's WordPress /claim-territory page (see
 * src/content/wp-import/index.ts), with one deliberate change: the original
 * embedded a WPForms shortcode whose <form action="..."> only resolves
 * correctly when WordPress itself renders the page for a real visitor — the
 * export script fetched it via the REST API, which baked in that request's
 * URL instead of a submittable endpoint, so the form as exported is dead.
 * The surrounding hand-written copy is real and kept; the broken form block
 * is replaced with this app's own working <TerritoryClaim /> (already wired
 * to /api/territory/check and /api/demo-request).
 */
export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: claimTerritoryContent.title,
    description: claimTerritoryContent.description,
    path: "/claim-territory",
    origin,
  });
}

export default function ClaimTerritoryPage() {
  return (
    <div className="flex min-h-full flex-col bg-white text-slate-900">
      <SiteHeader />
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Claim Territory", href: "/claim-territory" }]} />
      <main id="main-content" className="flex-1">
        <div dangerouslySetInnerHTML={{ __html: claimTerritoryContent.beforeHtml }} />
        <TerritoryClaim source="claim_territory_page" />
        <div dangerouslySetInnerHTML={{ __html: claimTerritoryContent.afterHtml }} />
      </main>
      <SiteFooter />
    </div>
  );
}
