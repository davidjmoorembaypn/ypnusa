import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BreadcrumbSchema } from "@/components/seo/breadcrumbs";
import { RateSheetDirectory } from "@/components/rate-sheets/rate-sheet-directory";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_SITE_URL } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return marketingMetadata({
    title: "Rate sheet and lock desk directory for loan officers",
    description:
      "Where mortgage loan officers find pricing by loan type: public benchmarks, agency guides and the lender rate sheets and lock desks that set real prices. Conventional, FHA, VA, jumbo and DSCR.",
    path: "/rate-sheets",
    origin: MARKETING_SITE_URL,
  });
}

export default function RateSheetsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <SiteHeader />
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Rate sheet directory", href: "/rate-sheets" }]} />
      <main id="main-content" className="flex-1">
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-800">For licensed loan officers</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-tight text-[#13254a] lg:text-5xl">
              Rate sheet and lock desk directory
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-700">
              Filter by loan type to see where to check the market, which agency rules apply and which lender sheets set the price you can
              actually lock. Every entry says who publishes it and how often it updates.
            </p>
            <p className="mt-4 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              This directory lists sources, not rates. Public benchmarks show where the market is, not what a borrower will be offered. Only your
              lender&rsquo;s rate sheet and lock desk show pricing you can lock, and rates change. Nothing here is a rate quote or a loan offer.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <RateSheetDirectory />
          </div>
        </section>

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold text-[#13254a]">Put it to work in your ZIP code</h2>
            <p className="mt-3 text-slate-700">
              Knowing where to look is half of a fast, confident quote. The other half is borrowers who find you first. Each YPN USA paid plan
              includes one exclusive ZIP code for one loan officer.
            </p>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#13254a]">
              <Link href="/#claim" className="underline">
                Check your ZIP code
              </Link>
              <Link href="/markets" className="underline">
                Big-city market data
              </Link>
              <Link href="/pricing" className="underline">
                See plans
              </Link>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
