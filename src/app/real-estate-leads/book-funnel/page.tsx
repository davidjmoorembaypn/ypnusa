import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { StubNotice } from "@/components/silo/stub-notice";

export const metadata: Metadata = {
  title: "Book Funnel",
  description: "Amazon book funnel link-structure stub for the real-estate-leads silo.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Real Estate Leads", href: "/real-estate-leads" },
  { name: "Book Funnel", href: "/real-estate-leads/book-funnel" },
];

// Structural placeholders only — no live ASIN/affiliate tag until the
// publisher confirms the current listing and an FTC-compliant disclosure.
const FUNNEL_STEPS = [
  { label: "Landing page", href: "/real-estate-leads/book-funnel", status: "this page" },
  { label: "Amazon listing", href: "#", status: "placeholder link" },
  { label: "Lead capture", href: "/real-estate-leads", status: "placeholder link" },
];

export default function BookFunnelPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Funnel stub
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Book funnel</h1>
      <StubNotice>
        No live Amazon link is wired up yet. Replace the placeholder step below with the real
        listing URL and an FTC-compliant affiliate disclosure before this page is indexed.
      </StubNotice>

      <ol className="mt-10 space-y-3">
        {FUNNEL_STEPS.map((step, index) => (
          <li
            key={step.label}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
          >
            <span className="text-white">
              {index + 1}. {step.label}
            </span>
            <span className="text-xs text-white/40">{step.status}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/real-estate-leads" className="text-violet-300 underline hover:text-violet-200">
          Real estate leads hub
        </Link>
      </div>
    </div>
  );
}
