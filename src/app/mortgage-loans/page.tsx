import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { MortgageLoansFinancialProductSchema } from "@/components/seo/silo-schema";
import { PROGRAM_LIST } from "@/lib/programs";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
import { appUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mortgage Loan Programs",
  description:
    "FHA, VA, conventional, DSCR, HELOC, refinance, and jumbo — program overviews from a licensed loan officer with 25+ years in mortgage lending.",
  alternates: { canonical: appUrl("/mortgage-loans") },
  robots: { index: true, follow: true },
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
        Educational overviews of the loan programs supported on the YPN USA platform, written for
        borrowers evaluating their options before talking to a licensed loan officer.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {PROGRAM_LIST.map((program) => (
          <li key={program}>
            <Link
              href={`/mortgage-loans/${program.toLowerCase()}`}
              className="block rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <p className="text-sm font-semibold text-white">{PROGRAM_CONTENT[program].label}</p>
              <p className="mt-1 text-xs text-white/50">{PROGRAM_CONTENT[program].summary}</p>
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
        <Link href="/consultation" className="text-violet-300 underline hover:text-violet-200">
          Talk to a loan officer
        </Link>
      </div>
    </div>
  );
}
