import { AUTHOR_NAME, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";
import { FOUNDER_ID } from "@/lib/seo";

/**
 * Person JSON-LD for the founder with his professional licenses as
 * EducationalOccupationalCredential entries, so search and AI answer engines can
 * tie the site's claims to verifiable NMLS and California DRE records.
 */
export function founderCredentialJsonLd() {
  return {
    "@type": "Person",
    "@id": FOUNDER_ID,
    name: AUTHOR_NAME,
    jobTitle: "Founder, YPN USA",
    worksFor: { "@id": `${MARKETING_SITE_URL}/#organization` },
    hasCredential: [
      {
        "@type": "EducationalOccupationalCredential",
        name: `NMLS Mortgage Loan Originator License #${NMLS_ID}`,
        credentialCategory: "license",
        identifier: NMLS_ID,
        url: NMLS_CONSUMER_ACCESS_URL,
        recognizedBy: { "@type": "Organization", name: "Nationwide Multistate Licensing System (NMLS)" },
      },
      {
        "@type": "EducationalOccupationalCredential",
        name: `California DRE License #${CA_DRE_ID}`,
        credentialCategory: "license",
        identifier: CA_DRE_ID,
        recognizedBy: { "@type": "GovernmentOrganization", name: "California Department of Real Estate" },
      },
    ],
  };
}
