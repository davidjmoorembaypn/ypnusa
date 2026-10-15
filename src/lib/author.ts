/** Public facts about the founder and book, shared by /about, /book and /consultation. */

export const AUTHOR_NAME = "David J. Moore, MBA";

export const BOOK_TITLE = "Top 9 Online Real Estate Leads Even the Gurus Do Not Know About";

/** Cover artwork is titled "Top 9 Secret Online Real Estate Leads". */
export const BOOK_COVER_TITLE = "Top 9 Secret Online Real Estate Leads";

export const BOOK_AMAZON_URL =
  "https://www.amazon.ca/Online-Estate-Leads-Gurus-About/dp/1548169889";

export const BUSINESS_PHONE_E164 = "+15595120372";
export const BUSINESS_PHONE_DISPLAY = "(559) 512-0372";
export const BUSINESS_EMAIL = "support@ypnus.com";

export const NMLS_ID = "787257";
export const NMLS_CONSUMER_ACCESS_URL = `https://www.nmlsconsumeraccess.org/EntityDetails.aspx/individual/${NMLS_ID}`;
export const CA_DRE_ID = "01852847";

/** Optional external scheduler (Calendly, Google Calendar appointment page, etc.). */
export const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL?.trim() || "";

export const AUTHOR_PROFILES = {
  linkedin: "https://www.linkedin.com/in/davidjmoorembaypninc/",
  facebook: "https://www.facebook.com/DavidjMooreMBA/about/",
  orcid: "https://orcid.org/0009-0008-8069-8897",
} as const;
