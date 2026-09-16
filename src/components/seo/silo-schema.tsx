import { appUrl, centralValleyAreaServed, MARKETING_SITE_URL } from "@/lib/site";

const ORGANIZATION_REF = { "@id": `${MARKETING_SITE_URL}/#organization` };
const PERSON_DAVID_MOORE_REF = { "@id": `${MARKETING_SITE_URL}/#person-david-moore` };
const WEBSITE_REF = { "@id": `${MARKETING_SITE_URL}/#website` };

function JsonLdScript({ jsonLd }: { jsonLd: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/** FinancialProduct schema for the mortgage-loans program directory. */
export function MortgageLoansFinancialProductSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    "@id": `${appUrl("/mortgage-loans")}#financial-product`,
    name: "YPN USA Mortgage Loan Programs",
    category: "Mortgage",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: appUrl("/mortgage-loans"),
    description:
      "Directory of mortgage loan programs (FHA, VA, Conventional, DSCR, HELOC, refinance, jumbo) reviewed by licensed loan officers on the YPN USA platform.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}

/**
 * Service schema placeholder for the real-estate-leads hub. Route content is
 * an unreviewed stub (see StubNotice / noindex on this route); refine once
 * the lead-gen offer is finalized.
 */
export function RealEstateLeadsServiceSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${appUrl("/real-estate-leads")}#service`,
    name: "YPN USA Real Estate Lead Generation",
    serviceType: "Real estate lead generation",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: appUrl("/real-estate-leads"),
    description:
      "Placeholder listing for the real-estate-leads silo's local demand tools and book funnel. Not a live offer.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}

/**
 * EducationalOrganization schema placeholder for the ai-platform (Cerebro)
 * workspace. Route content is an unreviewed stub (see StubNotice / noindex
 * on this route); refine once training/education content ships.
 */
export function AiPlatformEducationalOrganizationSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${appUrl("/ai-platform")}#educational-organization`,
    name: "YPN USA Cerebro AI Platform",
    parentOrganization: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: appUrl("/ai-platform"),
    description:
      "Placeholder listing for planned Cerebro AI assistant training and MLO autopilot education content.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}

/**
 * ProfilePage + Person E-E-A-T schema for the /about Author Hub. Reuses the
 * SAME Person @id as the site-wide graph in layout.tsx and repeats its core
 * facts verbatim (jobTitle, worksFor, alumniOf, hasCredential, sameAs) so the
 * two pages describe one consistent entity rather than diverging claims;
 * this page's graph only ADDS the deeper detail (owns, knowsAbout, authored
 * book) that doesn't belong in the lightweight site-wide node.
 */
export function AboutProfilePageSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${appUrl("/about")}#profilepage`,
        url: appUrl("/about"),
        name: "About David J. Moore, MBA — Founder, YPN USA",
        description:
          "Author hub for David J. Moore, MBA: CEO of YPN Inc, founder of ToInvested.com, and creator of the YPN USA Agentic AI System.",
        isPartOf: WEBSITE_REF,
        about: PERSON_DAVID_MOORE_REF,
        mainEntity: PERSON_DAVID_MOORE_REF,
      },
      {
        "@type": "Person",
        "@id": `${MARKETING_SITE_URL}/#person-david-moore`,
        name: "David J. Moore, MBA",
        jobTitle: "CEO & Founder",
        worksFor: [
          ORGANIZATION_REF,
          { "@type": "Organization", name: "ToInvested.com" },
        ],
        owns: [WEBSITE_REF],
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "California State University, Fresno",
        },
        hasCredential: {
          "@type": "EducationalOccupationalCredential",
          credentialCategory: "MBA",
        },
        description:
          "Former top-producing mortgage professional with thousands of closed home loans at JPMorgan Chase and Wells Fargo Home Mortgage. Published Amazon real estate author and nationwide industry speaker.",
        knowsAbout: [
          "Mortgage lending",
          "Real estate lead generation",
          "Agentic AI systems",
          "Exclusive-territory sales models",
        ],
        author: [
          {
            "@type": "Book",
            name: "Top 9 Secret Online Real Estate Leads Even the Gurus Do Not Know About",
          },
        ],
        sameAs: [
          "https://orcid.org/0009-0008-8069-8897",
          "https://www.linkedin.com/in/davidjmoorembaypninc/",
          "https://www.facebook.com/DavidjMooreMBA/about/",
        ],
      },
    ],
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}
