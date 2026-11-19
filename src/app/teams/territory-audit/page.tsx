import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { TerritoryAuditTool } from "@/components/teams/territory-audit-tool";
import { homeTrail } from "@/lib/seo/breadcrumbs";
import { marketingMetadata } from "@/lib/seo";

const PATH = "/teams/territory-audit";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({
    title: "Multi-ZIP territory audit for branch managers",
    description:
      "See which ZIP codes around your branch are still open and which are claimed, with expected buyer, seller and mover activity, then lock a ZIP code for each loan officer on your team. Free to run.",
    path: PATH,
  });
}

export default async function TerritoryAuditPage({ searchParams }: { searchParams: Promise<{ zip?: string | string[] }> }) {
  const { zip } = await searchParams;
  const first = Array.isArray(zip) ? zip[0] : zip;
  const initialZip = /^\d{5}$/.test(first ?? "") ? (first as string) : "";

  return (
    <div className="flex min-h-full flex-col bg-[#09081b] text-white">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <Breadcrumbs items={homeTrail({ name: "Teams", href: "/teams" }, { name: "Territory audit", href: PATH })} />
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-200">For branch managers and team leads</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">Which ZIP codes around your branch are still open?</h1>
          <p className="mt-4 max-w-3xl text-lg text-white/80">
            Enter your office ZIP code and a radius. You&rsquo;ll see how many ZIP codes are in range, how many are open or already claimed, and the expected activity
            across the open ones. Each loan officer on your team can then lock their own ZIP code. One loan officer per ZIP code on YPN USA.
          </p>
          <div className="mt-8">
            <TerritoryAuditTool initialZip={initialZip} />
          </div>
          <p className="mt-10 border-t border-white/15 pt-6 text-xs leading-6 text-white/70">
            YPN Inc. &middot; Exclusivity applies within YPN USA. Not a rate quote or commitment to lend, and no results are guaranteed.{" "}
            <Link href="/teams" className="underline hover:text-white">
              YPN USA for teams
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
