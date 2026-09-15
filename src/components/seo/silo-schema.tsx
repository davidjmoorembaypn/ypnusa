import { appUrl, centralValleyAreaServed, MARKETING_SITE_URL } from "@/lib/site";

const ORGANIZATION_REF = { "@id": `${MARKETING_SITE_URL}/#organization` };

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
