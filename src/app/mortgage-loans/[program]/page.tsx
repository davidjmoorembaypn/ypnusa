import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { StubNotice } from "@/components/silo/stub-notice";
import { appUrl } from "@/lib/site";
import { PROGRAM_LIST } from "@/lib/programs";
import { PROGRAM_LABELS } from "../program-labels";
import type { LoanProgram } from "@/lib/types";

type Props = {
  params: Promise<{ program: string }>;
};

function getProgram(slug: string): LoanProgram | undefined {
  const normalized = slug.toUpperCase();
  return PROGRAM_LIST.find((program) => program === normalized);
}

export function generateStaticParams() {
  return PROGRAM_LIST.map((program) => ({ program: program.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { program: slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const label = PROGRAM_LABELS[program];
  return {
    title: label,
    description: `Placeholder program stub for ${label} on YPN USA. Not a rate quote or offer of credit.`,
    robots: { index: false, follow: true },
  };
}

export default async function MortgageLoanProgramPage({ params }: Props) {
  const { program: slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const label = PROGRAM_LABELS[program];
  const path = `/mortgage-loans/${slug}`;

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Mortgage Loans", href: "/mortgage-loans" },
    { name: label, href: path },
  ];

  // Placeholder FinancialProduct schema — replace values once a licensed
  // loan officer supplies reviewed program terms.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "@id": `${appUrl(path)}#product`,
    name: `${label} (placeholder)`,
    category: "MortgageLoan",
    url: appUrl(path),
    provider: { "@id": `${appUrl("/")}#organization` },
    description: `Placeholder listing for ${label}. Program terms, rates, and eligibility are not yet published.`,
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Program stub
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{label}</h1>
      <StubNotice>
        This page reserves the URL for {label.toLowerCase()} content. Nothing here is a rate,
        eligibility claim, or offer of credit &mdash; see the licensing disclosure below before
        publishing.
      </StubNotice>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          All programs
        </Link>
        <Link href="/mortgage-loans/tools" className="text-violet-300 underline hover:text-violet-200">
          MLO portal tools
        </Link>
        <Link href="/licensing-disclosures" className="text-violet-300 underline hover:text-violet-200">
          Licensing &amp; disclosures
        </Link>
      </div>
    </div>
  );
}
