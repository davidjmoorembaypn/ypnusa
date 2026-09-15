import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { StubNotice } from "@/components/silo/stub-notice";
import { marketingUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Real Estate Lead Generation",
  description: "Lead-gen hub stub for real-estate-focused content and the book funnel.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Real Estate Leads", href: "/real-estate-leads" },
];

export default function RealEstateLeadsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Lead-gen hub
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Real estate lead generation
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        Entry point for the real-estate-leads content silo: local demand tools, the ZIP-territory
        product, and the author&apos;s book funnel.
      </p>
      <StubNotice>Hub layout only &mdash; section copy below is placeholder.</StubNotice>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/real-estate-leads/book-funnel"
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold text-white">Book funnel</p>
            <p className="mt-1 text-xs text-white/50">Amazon book funnel link structure stub &rarr;</p>
          </Link>
        </li>
        <li>
          <a
            href={marketingUrl("/check-zip.html")}
            className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
          >
            <p className="text-sm font-semibold text-white">ZIP demand check</p>
            <p className="mt-1 text-xs text-white/50">Live territory-availability tool &rarr;</p>
          </a>
        </li>
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          Mortgage loans
        </Link>
        <Link href="/ai-platform" className="text-violet-300 underline hover:text-violet-200">
          AI platform
        </Link>
      </div>
    </div>
  );
}
