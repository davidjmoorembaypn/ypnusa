/**
 * Lead forms inside imported WordPress pages. Their WordPress handlers are gone (the
 * contact form had no script at all, so a submit reloaded the page with the visitor's
 * name, email and message in the URL; the MLO hub's briefing form posted to a REST route
 * that no longer exists). WpFormBridge wires them to /api/demo-request instead, where
 * every other site lead is saved and emailed to the owner.
 */

export interface WpFormSpec {
  /** id of the <form> in the imported HTML. */
  formId: string;
  /** Lead source saved with the inquiry and shown in the owner's email. */
  source: string;
  /** Field names in the imported markup. */
  fields: { name: string; email: string; message?: string; phone?: string; smsConsent?: string; honeypot?: string };
  /** Checkbox that must be ticked before sending (the form already says so). */
  requiredCheckbox?: string;
  /** What the owner's email says the visitor asked for, when the form has no message box. */
  note?: string;
  /** id of a success panel the page already has; otherwise the status line gets `successText`. */
  successId?: string;
  successText: string;
}

export const WP_FORMS: readonly WpFormSpec[] = [
  {
    formId: "contact-form",
    source: "contact_page",
    fields: { name: "ct_name", email: "ct_email", message: "ct_message", phone: "ct_phone", smsConsent: "ct_tcpa_consent" },
    successId: "ct-success",
    successText: "Message sent. We'll be in touch within 1 business day.",
  },
  {
    formId: "ypnHubBrief",
    source: "mlo_hub_briefing",
    fields: { name: "name", email: "email", honeypot: "website" },
    requiredCheckbox: "consent",
    note: "Asked for the MLO growth briefing and agreed to product emails.",
    successText: "Thanks, you're on the list.",
  },
];

export interface WpFormValues {
  name: string;
  email: string;
  message?: string;
  phone?: string;
  smsConsent?: boolean;
  checkboxTicked?: boolean;
  honeypot?: string;
}

export type WpFormCheck =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; spam: true }
  | { ok: false; spam?: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates a submit and builds the /api/demo-request body. */
export function wpFormPayload(spec: WpFormSpec, values: WpFormValues): WpFormCheck {
  if (values.honeypot?.trim()) return { ok: false, spam: true };
  const name = values.name.trim();
  const email = values.email.trim();
  if (!name || !EMAIL.test(email)) return { ok: false, error: "Enter your name and a valid email address." };
  if (spec.fields.message && !values.message?.trim()) return { ok: false, error: "Add a short message so we know how to help." };
  if (spec.requiredCheckbox && !values.checkboxTicked) return { ok: false, error: "Please confirm we may email you." };
  const phone = values.phone?.trim();
  const message = [values.message?.trim(), spec.note].filter(Boolean).join("\n\n");
  return {
    ok: true,
    payload: {
      name,
      workEmail: email,
      ...(phone ? { phone } : {}),
      ...(message ? { message } : {}),
      source: spec.source,
      // The SMS/call consent box only counts with a phone number to call or text.
      consent: Boolean(phone && values.smsConsent),
    },
  };
}
