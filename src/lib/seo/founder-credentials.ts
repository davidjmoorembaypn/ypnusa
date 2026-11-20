import { AUTHOR_ALTERNATE_NAMES, AUTHOR_NAME, AUTHOR_PROFILES, BOOK_AMAZON_URL, BOOK_TITLE, CA_DRE_ID, NMLS_CONSUMER_ACCESS_URL, NMLS_ID } from "@/lib/author";
import { BUSINESS_ADDRESS, BUSINESS_LEGAL_NAME, BUSINESS_NAME, BUSINESS_TELEPHONE } from "@/lib/business-profile";
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
    alternateName: [...AUTHOR_ALTERNATE_NAMES],
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
 * The full founder node (education, licenses, profiles). Emitted on /about, in blog-post author
 * boxes and, inside a connected @graph, by AuthorReviewerCard on reviewed pages. Facts match the visible bio: 25+ years, 2,000+ loans, Fresno State MBA.
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
    sameAs: [NMLS_CONSUMER_ACCESS_URL, AUTHOR_PROFILES.orcid, AUTHOR_PROFILES.linkedin, AUTHOR_PROFILES.facebook],
  };
}

export interface ReviewedPage {
  /** Absolute canonical URL of the page. */
  url: string;
  name: string;
  /** True when the founder also wrote the page; false when he only reviewed it. */
  written?: boolean;
  /**
   * The @id of the node the page already emits for itself (its WebPage, Article, Report...). When
   * given, author and reviewer are attached to THAT node, so search engines merge them into one
   * entity instead of seeing a second, competing page node. Omit it only for a page with no node.
   */
  pageId?: string;
  /** The @type of that existing node. Defaults to WebPage. Must match what the page emits. */
  pageType?: string;
}

/**
 * One connected @graph for a reviewed page: the Organization and the founder Person (the same
 * @ids the root layout uses, so they merge rather than duplicate), his published book, and a
 * WebPage node that names him as author and reviewer. Every fact here is also visible on the page
 * (AuthorReviewerCard) or on /about.
 *
 * The book is its own Book node with `author`, not a `sameAs` of the person: sameAs means "the same
 * entity", and a book is not the person. The plain Amazon listing is used, never an affiliate link.
 */
export function authorReviewerGraphJsonLd(page: ReviewedPage) {
  const { "@context": _context, ...person } = founderPersonJsonLd();
  void _context;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: BUSINESS_NAME,
        legalName: BUSINESS_LEGAL_NAME,
        url: MARKETING_SITE_URL,
        telephone: BUSINESS_TELEPHONE,
        address: { "@type": "PostalAddress", ...BUSINESS_ADDRESS },
        founder: { "@id": FOUNDER_ID },
      },
      person,
      {
        "@type": "Book",
        "@id": `${MARKETING_SITE_URL}/#book-top-9-online-real-estate-leads`,
        name: BOOK_TITLE,
        author: { "@id": FOUNDER_ID },
        url: BOOK_AMAZON_URL,
      },
      page.pageId
        ? {
            // Same @id and @type as the page's own node: this only adds the people to it.
            "@type": page.pageType ?? "WebPage",
            "@id": page.pageId,
            ...(page.written === false ? {} : { author: { "@id": FOUNDER_ID } }),
            reviewedBy: { "@id": FOUNDER_ID },
            publisher: { "@id": ORGANIZATION_ID },
          }
        : {
            "@type": "WebPage",
            "@id": `${page.url}#webpage`,
            url: page.url,
            name: page.name,
            ...(page.written === false ? {} : { author: { "@id": FOUNDER_ID } }),
            reviewedBy: { "@id": FOUNDER_ID },
            publisher: { "@id": ORGANIZATION_ID },
          },
    ],
  };
}
