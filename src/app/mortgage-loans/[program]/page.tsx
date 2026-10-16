import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { appUrl } from "@/lib/site";
import { PROGRAM_LIST } from "@/lib/programs";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
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

  const content = PROGRAM_CONTENT[program];
  const path = `/mortgage-loans/${slug}`;
  return {
    title: content.label,
    description: content.summary,
    alternates: { canonical: appUrl(path) },
    robots: { index: true, follow: true },
  };
}

export default async function MortgageLoanProgramPage({ params }: Props) {
  const { program: slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const content = PROGRAM_CONTENT[program];
  const path = `/mortgage-loans/${slug}`;

  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Mortgage Loans", href: "/mortgage-loans" },
    { name: content.label, href: path },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "@id": `${appUrl(path)}#product`,
    name: content.label,
    category: "MortgageLoan",
    url: appUrl(path),
    provider: { "@id": `${appUrl("/")}#organization` },
    description: content.summary,
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
        Loan program
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{content.label}</h1>
      <p className="mt-5 text-base leading-7 text-white/70">{content.intro}</p>

      <h2 className="mt-10 text-lg font-semibold text-white">Good fit for</h2>
      <ul className="mt-3 space-y-1.5 text-sm text-white/70">
        {content.idealFor.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="text-violet-300">
              &bull;
            </span>
            {item}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-lg font-semibold text-white">Key features</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        {content.keyFeatures.map((feature) => (
          <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <dt className="text-sm font-semibold text-white">{feature.title}</dt>
            <dd className="mt-1.5 text-[13px] leading-5 text-white/65">{feature.body}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-lg font-semibold text-white">Common questions</h2>
      <div className="mt-4 space-y-3">
        {content.faqs.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-white/10 bg-white/5 p-4 [&_summary]:cursor-pointer"
          >
            <summary className="text-sm font-semibold text-white marker:content-none">{item.q}</summary>
            <p className="mt-2 text-[13px] leading-5 text-white/65">{item.a}</p>
          </details>
        ))}
      </div>

      <p className="mt-10 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-5 text-white/40">
        Educational overview only. Nothing on this page is a rate quote, an eligibility
        determination, or a commitment to lend. See{" "}
        <Link href="/licensing-disclosures" className="underline hover:text-white/70">
          Licensing &amp; Disclosures
        </Link>{" "}
        for current licensing. Equal Housing Opportunity.
      </p>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Link href="/mortgage-loans" className="text-violet-300 underline hover:text-violet-200">
          All programs
        </Link>
        <Link href="/mortgage-loans/tools" className="text-violet-300 underline hover:text-violet-200">
          MLO portal tools
        </Link>
        <Link href="/consultation" className="text-violet-300 underline hover:text-violet-200">
          Talk to a loan officer
        </Link>
      </div>
    </div>
  );
}
