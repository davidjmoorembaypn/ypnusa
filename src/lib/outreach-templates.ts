import { MARKETING_SITE_URL } from "@/lib/site";
import { AUTHOR_NAME, NMLS_ID } from "@/lib/author";

/**
 * Outreach copy for the "neighbor lock" scarcity alerts. Pure strings, no server imports, so the
 * hook (server) and the admin matcher (browser) share exactly the same text.
 *
 * Nothing here sends anything: the admin copies a message or opens it in their own mail client.
 * Keep it honest: only describe a ZIP code as "just locked" when a real lock event says so, never
 * quote rates, and never promise leads or loans. Exclusivity is within YPN USA.
 */

export const OUTREACH_VARIANTS = ["email_fomo", "linkedin_dm", "branch_audit_pitch"] as const;
export type OutreachVariant = (typeof OUTREACH_VARIANTS)[number];

/** Left in the stored text on purpose; the admin matcher fills them from an uploaded contact. */
export const FIRST_NAME_PLACEHOLDER = "{{First_Name}}";
export const EMAIL_PLACEHOLDER = "{{Email}}";

export interface OutreachVars {
  lockedZip: string;
  lockedCity: string;
  targetZip: string;
  targetCity: string;
}

export interface OutreachPayload {
  email_fomo: { subject: string; body: string };
  linkedin_dm: { body: string };
  branch_audit_pitch: { body: string };
}

const POSTAL_ADDRESS = "YPN Inc., 247 N L Street, Dinuba, CA 93618";
const SIGNATURE = `${AUTHOR_NAME}\nFounder, YPN USA | NMLS #${NMLS_ID}`;
const OPT_OUT = `If you'd rather not get emails like this, reply "unsubscribe" and I'll remove you right away.`;

function utm(source: string, medium: string): string {
  return `utm_source=${source}&utm_medium=${medium}&utm_campaign=zip_scarcity`;
}

/** Replaces {{key}} for the keys given and leaves every other {{placeholder}} untouched. */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? values[key] : match));
}

const place = (zip: string, city: string) => (city ? `${zip} (${city})` : zip);

const EMAIL_SUBJECT = "Heads up on {{targetZip}} (neighboring {{lockedZip}} just closed)";

const EMAIL_BODY = `Hi {{First_Name}},

Quick heads up. ZIP code {{lockedPlace}} just locked to a single loan officer on YPN USA. {{targetPlace}} is still open nearby, and every ZIP code on YPN USA goes to one loan officer, never a shared seat.

If you work that area, you can check it and lock it here:
${MARKETING_SITE_URL}/claim-territory?zip={{targetZip}}&${utm("fomo_email", "email")}

Checking is free and doesn't reserve the ZIP code. It locks at a first payment on a paid plan, and the first loan officer to pay gets it. Exclusivity applies within YPN USA, and no results or lead volume are guaranteed.

${SIGNATURE}
${POSTAL_ADDRESS}

This message was sent to {{Email}}. ${OPT_OUT}`;

const LINKEDIN_BODY = `Hi {{First_Name}}, are you claiming {{targetPlaceIn}} before another loan officer locks it? ZIP {{lockedZip}} nearby just went to a single LO on YPN USA (one loan officer per ZIP code). Free to check: ${MARKETING_SITE_URL}/claim-territory?zip={{targetZip}}&${utm("linkedin_dm", "social")}`;

const BRANCH_BODY = `Hi {{First_Name}},

If you manage loan officers near {{targetPlace}}, this free tool shows which ZIP codes around your office are still open and which are already taken:
${MARKETING_SITE_URL}/teams/territory-audit?zip={{targetZip}}&${utm("branch_audit", "outreach")}

Each loan officer on your team gets their own ZIP code on their own plan, so your team covers different ZIP codes instead of competing for the same borrowers. The audit doesn't reserve anything and makes no promise of leads or loans.

${SIGNATURE}
${POSTAL_ADDRESS}

${OPT_OUT}`;

/** The three variants for one open ZIP code, with {{First_Name}} and {{Email}} left in place. */
export function buildOutreachPayload(vars: OutreachVars): OutreachPayload {
  const values = {
    lockedZip: vars.lockedZip,
    targetZip: vars.targetZip,
    lockedPlace: place(vars.lockedZip, vars.lockedCity),
    targetPlace: place(vars.targetZip, vars.targetCity),
    targetPlaceIn: vars.targetCity ? `${vars.targetZip} in ${vars.targetCity}` : vars.targetZip,
  };
  return {
    email_fomo: { subject: renderTemplate(EMAIL_SUBJECT, values), body: renderTemplate(EMAIL_BODY, values) },
    linkedin_dm: { body: renderTemplate(LINKEDIN_BODY, values) },
    branch_audit_pitch: { body: renderTemplate(BRANCH_BODY, values) },
  };
}

export interface ContactFill {
  firstName: string;
  email: string;
}

/** Fills {{First_Name}} and {{Email}}. A missing first name reads "there", never a blank. */
export function fillContactPlaceholders(text: string, contact: ContactFill): string {
  return renderTemplate(text, {
    First_Name: contact.firstName.trim() || "there",
    Email: contact.email.trim(),
  });
}

/** Most mail clients and browsers accept mailto: links up to roughly this many characters. */
export const MAILTO_MAX_LENGTH = 1900;

/** A mailto: link, or null when it would be too long for clients to open reliably. */
export function buildMailto(email: string, subject: string, body: string): string | null {
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email.trim())) return null;
  const url = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return url.length <= MAILTO_MAX_LENGTH ? url : null;
}
