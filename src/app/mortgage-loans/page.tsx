import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { MortgageLoansFinancialProductSchema } from "@/components/seo/silo-schema";
import { StubNotice } from "@/components/silo/stub-notice";
import { PROGRAM_LIST } from "@/lib/programs";
import { PROGRAM_LABELS } from "./program-labels";

export const metadata: Metadata = {
  title: "Mortgage Loan Programs",
  description:
    "Directory stub for loan-program pages served by licensed loan officers on the YPN USA platform.",
  robots: { index: false, follow: true },
};

const BREADCRUMB_ITEMS = [
  { name: "Home", href: "/" },
  { name: "Mortgage Loans", href: "/mortgage-loans" },
];

export default function MortgageLoansPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs items={BREADCRUMB_ITEMS} />
      <MortgageLoansFinancialProductSchema />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Program directory
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Mortgage loan programs
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/60">
        Entry point for the mortgage-loans content silo. Each program below links to a stub page
        reserved for licensed-loan-officer-reviewed program copy.
      </p>
      <StubNotice>
        Program pages below contain placeholder copy only and are not indexed until reviewed,
        program-specific content ships.
      </StubNotice>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {PROGRAM_LIST.map((program) => (
          <li key={program}>
            <Link
              href={`/mortgage-loans/${program.toLowerCase()}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-white">{PROGRAM_LABELS[program]}</p>
              <p className="mt-1 text-xs text-white/50">Program stub &rarr;</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans/tools" className="text-violet-300 underline hover:text-violet-200">
          MLO portal tools
        </Link>
        <Link href="/ai-platform" className="text-violet-300 underline hover:text-violet-200">
          AI platform
        </Link>
        <Link href="/real-estate-leads" className="text-violet-300 underline hover:text-violet-200">
          Real estate leads
        </Link>
      </div>
    </div>
  );
}
