import { MARKETING_SITE_URL, centralValleyAreaServed } from "@/lib/site";
import { AUTHOR_PROFILES, BUSINESS_EMAIL, BUSINESS_PHONE_DISPLAY } from "@/lib/author";

/**
 * Canonical business entity for YPN USA. Mirrors the Google Business Profile so the
 * site-wide Organization/ProfessionalService JSON-LD, the footer NAP line and the GBP
 * dashboard (docs/gbp-ready-to-paste.md) all say the same thing.
 *
 * Every service and claim here must describe what the product does today; see the
 * paste sheet for GBP wording David asked for that the product does not support yet.
 */
export const BUSINESS_NAME = "YPN USA";
/** Legal entity used in Terms, Privacy and disclosures (David confirmed Nov 17, 2026). */
export const BUSINESS_LEGAL_NAME = "YPN Inc.";
export const BUSINESS_TELEPHONE = "+1-559-512-0372";
export const BUSINESS_TELEPHONE_DISPLAY = BUSINESS_PHONE_DISPLAY;
export const BUSINESS_ADDRESS = {
  streetAddress: "247 N L St",
  addressLocality: "Dinuba",
  addressRegion: "CA",
  postalCode: "93618",
  addressCountry: "US",
} as const;
export const BUSINESS_ADDRESS_LINE = `${BUSINESS_ADDRESS.streetAddress}, ${BUSINESS_ADDRESS.addressLocality}, ${BUSINESS_ADDRESS.addressRegion} ${BUSINESS_ADDRESS.postalCode}`;

/** GBP hours as David set them: Monday to Saturday, 9 AM to 5 PM. */
export const BUSINESS_HOURS = {
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  opens: "09:00",
  closes: "17:00",
} as const;

/** Under 750 characters (GBP limit). Only claims the product supports today. */
export const BUSINESS_DESCRIPTION =
  "YPN USA helps licensed Mortgage Loan Officers stop buying shared leads and start owning their local market. Each paid plan includes one exclusive ZIP code within YPN USA, a local page for that ZIP code, and Cerebro AI, an assistant that answers borrower questions 24/7, qualifies them and hands ready borrowers to the loan officer with a summary. Cerebro also emails borrowers check-ins and first replies for the loan officer, on its own or after the officer approves them, and drafts local posts and Realtor co-marketing to review. Higher plans add a portable loan officer website and local city pages. Headquartered in Dinuba, CA, YPN USA serves mortgage professionals nationwide. Marketing technology only, not a lender.";

export const BUSINESS_SERVICES: ReadonlyArray<{ name: string; description: string }> = [
  {
    name: "Exclusive ZIP Code Territory Licensing",
    description:
      "Each paid plan includes one 5-digit ZIP code that no other YPN USA loan officer can claim while you hold it. It locks at your first payment.",
  },
  {
    name: "Loan Officer Website",
    description:
      "A public borrower page for each paying loan officer with licensing details and a Cerebro intake that routes leads to you, plus a portable loan officer website on Growth and Exclusive plans.",
  },
  {
    name: "Hyper-Local Mortgage SEO",
    description:
      "A local page for your ZIP code on every paid plan, plus local city pages for your market on Growth and Exclusive plans, written for homebuyers searching in your area.",
  },
  {
    name: "24/7 AI Lead Capture (Cerebro AI)",
    description:
      "Cerebro answers borrower questions any hour, qualifies them with consent, records the conversation and routes ready borrowers to you with a summary.",
  },
  {
    name: "Realtor Co-Marketing",
    description:
      "Cerebro drafts Realtor co-marketing and local posts for you to edit and share, so you can stay in front of real estate agents who refer buyers.",
  },
  {
    name: "Borrower Follow-Up Assistant",
    description:
      "Cerebro spots which borrowers need a follow-up and writes the email. By default it sends check-ins, first replies and rate alerts on its own to borrowers who agreed to be contacted, after compliance checks; in approve-first mode it holds each one for your OK. No texts or calls.",
  },
];

export function businessAreaServed() {
  return [
    { "@type": "Country" as const, name: "United States" },
    { "@type": "AdministrativeArea" as const, name: "Central Valley, California" },
    ...centralValleyAreaServed(),
  ];
}

/** Site-wide Organization + ProfessionalService node (rendered once, in the root layout). */
export function businessEntityJsonLd(founder: { "@id": string; name: string }) {
  return {
    "@type": ["Organization", "ProfessionalService"],
    "@id": `${MARKETING_SITE_URL}/#organization`,
    name: BUSINESS_NAME,
    legalName: BUSINESS_LEGAL_NAME,
    url: MARKETING_SITE_URL,
    description: BUSINESS_DESCRIPTION,
    email: BUSINESS_EMAIL,
    telephone: BUSINESS_TELEPHONE,
    address: { "@type": "PostalAddress", ...BUSINESS_ADDRESS },
    areaServed: businessAreaServed(),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: BUSINESS_HOURS.days.map((day) => `https://schema.org/${day}`),
      opens: BUSINESS_HOURS.opens,
      closes: BUSINESS_HOURS.closes,
    },
    // Full Person node (credentials) lives on /about and in post author boxes.
    founder: { "@type": "Person", ...founder },
    sameAs: [AUTHOR_PROFILES.linkedin, "https://www.facebook.com/YPN.Incorporated/"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "YPN USA services for mortgage loan officers",
      itemListElement: BUSINESS_SERVICES.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          description: service.description,
          provider: { "@id": `${MARKETING_SITE_URL}/#organization` },
          audience: { "@type": "BusinessAudience", audienceType: "Licensed mortgage loan officers" },
        },
      })),
    },
  };
}
