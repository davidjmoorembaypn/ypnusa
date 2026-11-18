import { marketingUrl, centralValleyAreaServed, MARKETING_SITE_URL } from "@/lib/site";

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
    "@id": `${marketingUrl("/mortgage-loans")}#financial-product`,
    name: "YPN USA Mortgage Loan Programs",
    category: "Mortgage",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: marketingUrl("/mortgage-loans"),
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
    "@id": `${marketingUrl("/real-estate-leads")}#service`,
    name: "YPN USA Real Estate Lead Generation",
    serviceType: "Real estate lead generation",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: marketingUrl("/real-estate-leads"),
    description:
      "Placeholder listing for the real-estate-leads silo's local demand tools and book funnel. Not a live offer.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}

/**
 * Service schema for the live /check-zip tool: a free 60-day buyer/seller/mover
 * demand forecast plus exclusive-slot availability for a ZIP code. Live, indexed
 * page (not a stub) — unlike the placeholders above, this describes a real offer.
 */
export function CheckZipServiceSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${marketingUrl("/check-zip")}#service`,
    name: "YPN USA ZIP Code Demand Check",
    serviceType: "Real estate market demand forecasting",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: marketingUrl("/check-zip"),
    isAccessibleForFree: true,
    description:
      "Free 60-day forecast of expected home buyers, sellers and movers in a ZIP code, plus whether an exclusive loan officer slot is still open.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}

/**
 * Service schema for the live /claim-territory page: claiming and locking an
 * exclusive ZIP code territory as a mortgage loan officer. Live, indexed page.
 */
export function ClaimTerritoryServiceSchema() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${marketingUrl("/claim-territory")}#service`,
    name: "YPN USA Exclusive ZIP Code Territory",
    serviceType: "Mortgage loan officer territory exclusivity",
    provider: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: marketingUrl("/claim-territory"),
    description:
      "Claim and lock an exclusive ZIP code so only one licensed loan officer on the YPN USA platform serves that territory. Checking availability is free; the territory locks on first payment.",
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
    "@id": `${marketingUrl("/ai-platform")}#educational-organization`,
    name: "YPN USA Cerebro AI Platform",
    parentOrganization: ORGANIZATION_REF,
    areaServed: centralValleyAreaServed(),
    url: marketingUrl("/ai-platform"),
    description:
      "Placeholder listing for planned Cerebro AI assistant training and MLO autopilot education content.",
  };
  return <JsonLdScript jsonLd={jsonLd} />;
}
