import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EquitySnapshot } from "@/components/equity-snapshot";
import { serializeJsonLd } from "@/lib/local-seo";
import { MARKETING_SITE_URL } from "@/lib/site";
import { getSiteOrigin } from "@/lib/request-host";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return {
    title: "Home Equity Snapshot",
    description:
      "Estimate home equity, loan-to-value, and an illustrative cash-out ceiling using values you provide.",
    alternates: { canonical: `${origin}/tools/equity` },
    robots: {
      index: true,
      follow: true,
    },
  };
}

const breadcrumbItems = [
  { name: "Home", href: "/" },
  { name: "Free Tools" },
  { name: "Home Equity Snapshot" },
];

export default async function EquitySnapshotPage() {
  const origin = await getSiteOrigin();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${origin}/tools/equity#app`,
    name: "YPN USA Home Equity Snapshot",
    url: `${origin}/tools/equity`,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    // Always the marketing-site entity id (see layout.tsx's @graph) — the
    // canonical Organization node regardless of which host served this page.
    isPartOf: { "@id": `${MARKETING_SITE_URL}/#organization` },
    isAccessibleForFree: true,
    description:
      "Free borrower tool that estimates home equity, loan-to-value, and an illustrative cash-out ceiling from values the visitor provides. Educational estimate only, not an appraisal or eligibility determination.",
  };
  return (
    <main className="min-h-screen bg-[#09081b] px-4 py-10 text-white sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <div className="mx-auto max-w-6xl">
        <nav className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-black">
              Y
            </span>
            YPN <span className="-ml-1 text-violet-300">USA</span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/10"
          >
            Back to home
          </Link>
        </nav>

        <Breadcrumbs items={breadcrumbItems} className="mt-6" />

        <header className="mx-auto max-w-3xl py-12 text-center sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
            Free borrower tool
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            See what your estimated home equity could unlock.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">
            Run a private first-pass snapshot with no signup. If you want help interpreting it,
            you can optionally ask a licensed loan officer to review the values you entered.
          </p>
        </header>

        <EquitySnapshot />

        <section className="mx-auto mt-14 max-w-3xl text-center">
          <h2 className="text-2xl font-semibold">Want the AI to keep working after the snapshot?</h2>
          <p className="mt-3 text-white/55">
            YPN USA turns one-time estimates into an ongoing growth workflow for mortgage and real
            estate professionals.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/#territories"
              className="inline-flex rounded-full bg-white px-6 py-3 font-bold text-[#17152f]"
            >
              Check Your ZIP — Free
            </Link>
            <Link
              href="/pricing"
              className="inline-flex rounded-full border border-white/25 px-6 py-3 font-semibold text-white/85 hover:bg-white/10"
            >
              See paid plans →
            </Link>
          </div>
        </section>

        <footer className="mt-10 border-t border-white/10 py-8 text-center text-xs leading-5 text-white/35">
          Educational estimate only. YPN USA does not perform an appraisal, determine eligibility,
          or promise proceeds through this calculator.
        </footer>
      </div>
    </main>
  );
}
