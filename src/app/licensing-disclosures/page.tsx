import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageLayout } from "@/components/legal-page-layout";

export const metadata: Metadata = {
  title: "Licensing & Disclosures",
  description: "NMLS licensing, Equal Housing Opportunity, and fair lending disclosures for YPN Inc.",
};

const LAST_UPDATED = "September 13, 2026";

export default function LicensingDisclosuresPage() {
  return (
    <LegalPageLayout
      title="Licensing & Disclosures"
      lastUpdated={LAST_UPDATED}
      intro="Required disclosures for YPN Inc. and the YPN USA platform."
    >
      <h2>Not a commitment to lend</h2>
      <p>
        YPN USA (app.ypnus.com and ypnus.com) is marketing technology used by licensed loan
        officers. It is not a lender, mortgage broker, or loan servicer, and nothing on this
        platform &mdash; including a ZIP-territory listing, an AI chat response, or an equity
        estimate &mdash; is an offer of credit, a pre-approval, or a commitment to lend. Actual
        loan origination, underwriting, and credit decisions are made solely by the licensed loan
        officer and their sponsoring lender.
      </p>

      <h2>NMLS licensing</h2>
      <p>
        David J. Moore, MBA &middot; NMLS #787257 &middot; California DRE #01852847.
      </p>
      <p>
        Current state-by-state licensing information, branch details, and regulatory status can be
        verified at{" "}
        <a
          href="https://www.nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/787257"
          target="_blank"
          rel="noopener noreferrer"
        >
          NMLS Consumer Access
        </a>
        . Individual loan officers who subscribe to this platform are independently licensed and
        are solely responsible for their own state-specific licensing and disclosures.
      </p>

      <h2>Equal Housing Opportunity</h2>
      <p>
        YPN Inc. and its Subscribers are committed to Equal Housing Opportunity. We do not
        discriminate on the basis of race, color, religion, sex, national origin, familial status,
        or disability, or on any basis prohibited by the Fair Housing Act, the Equal Credit
        Opportunity Act, or applicable state and local law.
      </p>

      <h2>Consumer complaints</h2>
      <p>
        If you have a complaint regarding a loan officer&rsquo;s use of this platform, you may
        contact us at{" "}
        <a href="mailto:support@ypnus.com">support@ypnus.com</a> or file a complaint directly with
        the NMLS via{" "}
        <a href="https://www.nmlsconsumeraccess.org/" target="_blank" rel="noopener noreferrer">
          NMLS Consumer Access
        </a>
        .
      </p>

      <h2>Related pages</h2>
      <ul>
        <li>
          <Link href="/privacy-policy">Privacy Policy</Link>
        </li>
        <li>
          <Link href="/terms-of-service">Terms of Service</Link>
        </li>
        <li>
          <Link href="/accessibility-statement">Accessibility Statement</Link>
        </li>
      </ul>
    </LegalPageLayout>
  );
}
