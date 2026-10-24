import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { ZipDemandCheck } from "@/components/zip-demand-check";
import { marketingMetadata } from "@/lib/seo";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return marketingMetadata({
    title: "What's happening in your zip code in the next 60 days?",
    description:
      "See how many people are expected to buy, sell or move into your zip code over the next 60 days, and whether an exclusive loan officer slot is still open. Free to check.",
    path: "/check-zip",
    origin,
  });
}

export default function CheckZipPage() {
  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Check your zip code", href: "/check-zip" }]} />
      <main id="main-content" className="flex-1">
        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:py-20">
          <h1 className="text-3xl font-semibold leading-tight md:text-5xl">
            What&rsquo;s happening in your zip code in the next 60 days?
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            Lead vendors rarely show you this number. See the expected buyers, sellers and movers in your zip code,
            and whether an exclusive slot is still open. Free, no credit card.
          </p>
          <div className="mt-8">
            <ZipDemandCheck />
          </div>
          <p className="mt-10 max-w-2xl border-t border-white/15 pt-6 text-xs leading-6 text-white/75">
            YPN INC &middot; NMLS #787257 &middot; Equal Housing Opportunity. Demand figures are estimates, not a
            guarantee of leads or loans. Not a commitment to lend.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
