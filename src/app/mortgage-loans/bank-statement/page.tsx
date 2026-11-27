import type { Metadata } from "next";
import { ProgramPage } from "@/components/program-page";
import { marketingMetadata } from "@/lib/seo";
import {
  BANK_STATEMENT_CONTENT,
  BANK_STATEMENT_PATH,
  DSCR_PATH,
  SELF_EMPLOYED_HUB_PATH,
} from "@/content/self-employed-loans";

export const metadata: Metadata = {
  ...marketingMetadata({
    // Absolute: the section template ("%s · Mortgage Loans · YPN USA") would make it 75 characters.
    title: "Bank Statement Loans for Self-Employed Borrowers | YPN USA",
    description: BANK_STATEMENT_CONTENT.summary,
    path: BANK_STATEMENT_PATH,
    absoluteTitle: true,
  }),
  robots: { index: true, follow: true },
};

export default function BankStatementLoanPage() {
  return (
    <ProgramPage
      content={BANK_STATEMENT_CONTENT}
      path={BANK_STATEMENT_PATH}
      program="BANK_STATEMENT"
      related={[
        { label: "Self-employed and investor mortgages in the Central Valley", href: SELF_EMPLOYED_HUB_PATH },
        { label: "DSCR loans for rental property", href: DSCR_PATH },
      ]}
    />
  );
}
