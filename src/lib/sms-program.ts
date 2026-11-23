/**
 * The YPN USA text message program, in one place. US carriers (A2P 10DLC registration) check
 * that the words a borrower agrees to, the texts they then get, and the privacy policy and terms
 * all describe the same program. Change the wording here, not in each form.
 */

export const SMS_BRAND = "YPN USA";
export const SMS_PRIVACY_URL = "https://ypnus.com/privacy-policy";
export const SMS_TERMS_URL = "https://ypnus.com/terms-of-service";

/** The carrier disclosures every opt-in and confirmation carries. */
export const SMS_DISCLOSURES = "Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";

/**
 * The consent question the intake chat asks, word for word. Borrowers can answer no and still
 * book a call, so texting is never a condition of service. The exact wording is stored in the
 * consent ledger with the answer.
 */
export const CONTACT_CONSENT_QUESTION =
  `May ${SMS_BRAND} and your assigned loan officer's team text and email you about this mortgage request, ` +
  `including call scheduling, reminders and follow-ups? Consent is not required to get help. ${SMS_DISCLOSURES} ` +
  `Terms: ypnus.com/terms-of-service. Privacy: ypnus.com/privacy-policy`;
