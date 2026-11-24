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

/**
 * The loan officer text opt-in on ypnus.com/sms-opt-in, word for word. Shown beside the consent
 * box (which starts unticked) and stored with each opt-in, so the record says exactly what the
 * officer agreed to.
 */
export const LO_SMS_CONSENT_STATEMENT =
  `By checking this box and submitting this form, I agree to receive SMS text messages from ${SMS_BRAND} ` +
  `regarding account notifications, borrower lead alerts, ZIP code territory lock updates, subscription alerts, ` +
  `and Cerebro AI assistant messages.`;

export const LO_SMS_CONSENT_DISCLOSURE =
  "Consent is not a condition of purchase or registration. Message frequency varies. " +
  "Message and data rates may apply. Reply STOP to opt out or HELP for support at any time.";

/** Both sentences as one string: what the consent ledger stores as the wording shown. */
export const LO_SMS_CONSENT_TEXT = `${LO_SMS_CONSENT_STATEMENT} ${LO_SMS_CONSENT_DISCLOSURE}`;

/** Public path of the loan officer opt-in page. */
export const LO_SMS_OPT_IN_PATH = "/sms-opt-in";
