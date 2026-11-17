/**
 * Lead sources that share /api/demo-request but are not territory requests: a contact-page
 * message and an MLO briefing sign-up carry no ZIP code and ask for nothing exclusive.
 * The results funnel and revenue figures leave them out so they don't inflate
 * "Requested a territory" or lower the trial conversion rate.
 */
export const GENERAL_INQUIRY_SOURCES: readonly string[] = ["contact_page", "mlo_hub_briefing"];

/** Longest message the lead endpoint stores; the site's forms check it before sending. */
export const LEAD_MESSAGE_MAX_LENGTH = 1000;

export function isGeneralInquiry(record: { source?: string }): boolean {
  return Boolean(record.source && GENERAL_INQUIRY_SOURCES.includes(record.source));
}

export function isTerritoryRequest(record: { source?: string }): boolean {
  return !isGeneralInquiry(record);
}
