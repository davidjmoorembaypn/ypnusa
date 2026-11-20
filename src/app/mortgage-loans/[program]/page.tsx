import type { Metadata } from "next";
import { marketingMetadata } from "@/lib/seo";
import { notFound, permanentRedirect } from "next/navigation";
import { ProgramPage } from "@/components/program-page";
import { PROGRAM_LIST } from "@/lib/programs";
import { PROGRAM_CONTENT } from "@/content/mortgage-programs";
import {
  BANK_STATEMENT_CONTENT,
  BANK_STATEMENT_PATH,
  DSCR_CALIFORNIA_FAQS,
  SELF_EMPLOYED_HUB_PATH,
} from "@/content/self-employed-loans";
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
  // Canonical URLs use the lowercase program slug (/mortgage-loans/fha, not /FHA).
  const path = `/mortgage-loans/${program.toLowerCase()}`;
  // marketingMetadata also gives the page its own Open Graph URL and image (the root
  // layout's point at the homepage) and keeps the description to search-result length.
  return {
    ...marketingMetadata({ title: content.label, description: content.summary, path }),
    robots: { index: true, follow: true },
  };
}

export default async function MortgageLoanProgramPage({ params }: Props) {
  const { program: slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  const content = PROGRAM_CONTENT[program];
  // Canonical URLs use the lowercase program slug (/mortgage-loans/fha, not /FHA).
  const path = `/mortgage-loans/${program.toLowerCase()}`;
  if (slug !== program.toLowerCase()) permanentRedirect(path);

  if (program === "DSCR") {
    return (
      <ProgramPage
        content={{ ...content, faqs: [...content.faqs, ...DSCR_CALIFORNIA_FAQS] }}
        path={path}
        program={program}
        related={[
          { label: "Self-employed and investor mortgages in the Central Valley", href: SELF_EMPLOYED_HUB_PATH },
          { label: BANK_STATEMENT_CONTENT.label, href: BANK_STATEMENT_PATH },
        ]}
      />
    );
  }

  return <ProgramPage content={content} path={path} program={program} />;
}
