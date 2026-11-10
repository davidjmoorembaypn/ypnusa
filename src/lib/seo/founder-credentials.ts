import { AUTHOR_NAME, AUTHOR_PROFILES, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";
import { MARKETING_SITE_URL } from "@/lib/site";
import { FOUNDER_ID, ORGANIZATION_ID } from "@/lib/seo";

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
    worksFor: { "@id": ORGANIZATION_ID },
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

/**
 * The full founder node (education, licenses, profiles). Per the Nov 2026 SEO plan it is
 * emitted only on /about and in blog-post author boxes; other pages refer to it by
 * FOUNDER_ID. Facts match the visible bio: 25+ years, 2,000+ loans, Fresno State MBA.
 */
export function founderPersonJsonLd() {
  const base = founderCredentialJsonLd();
  return {
    "@context": "https://schema.org",
    ...base,
    url: `${MARKETING_SITE_URL}/about`,
    image: `${MARKETING_SITE_URL}/images/david-j-moore-mba.jpg`,
    jobTitle: "CEO & Founder, YPN USA",
    worksFor: [{ "@id": ORGANIZATION_ID }, { "@type": "Organization", name: "ToInvested.com" }],
    description:
      "Loan officer for 25+ years with 2,000+ loans closed, formerly with Wells Fargo and JPMorgan Chase. Fresno State MBA. CA DRE #01852847, NMLS #787257.",
    alumniOf: { "@type": "CollegeOrUniversity", name: "California State University, Fresno" },
    hasCredential: [
      { "@type": "EducationalOccupationalCredential", name: "Master of Business Administration", credentialCategory: "degree" },
      ...base.hasCredential,
    ],
    sameAs: [AUTHOR_PROFILES.orcid, AUTHOR_PROFILES.linkedin, AUTHOR_PROFILES.facebook],
  };
}
