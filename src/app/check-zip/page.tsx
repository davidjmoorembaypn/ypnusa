import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { CheckZipServiceSchema } from "@/components/seo/silo-schema";
import { ZipDemandCheck } from "@/components/zip-demand-check";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const origin = MARKETING_SITE_URL;
  return marketingMetadata({
    title: "How much home-buying activity does your ZIP code see in 60 days?",
    description:
      "See a Census-based estimate of how many households buy, sell or move into your ZIP code in a typical 60 days, and whether an exclusive slot is open.",
    path: "/check-zip",
    origin,
  });
}

export default function CheckZipPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader variant="focused" />
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Check your ZIP code", href: "/check-zip" }]} />
      <CheckZipServiceSchema />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:py-20">
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            How much home-buying activity does your ZIP code see in 60 days?
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            See an estimate of the households that buy, sell or move into your ZIP code in a typical 60 days, built on U.S. Census Bureau data,
            and whether an exclusive slot is still open. Free, no credit card.
          </p>
          <div className="mt-8">
            <ZipDemandCheck />
          </div>
          <p className="mt-10 max-w-2xl border-t border-white/15 pt-6 text-xs leading-6 text-white/75">
            YPN Inc. &middot; David J. Moore, MBA, NMLS #787257 &middot; Equal Housing Opportunity. Demand figures are estimates, not a
            guarantee of leads or loans. Not a commitment to lend.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
