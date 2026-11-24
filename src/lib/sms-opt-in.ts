/**
 * Checks for the loan officer text opt-in form (ypnus.com/sms-opt-in). Pure and browser-safe:
 * the form runs the same checks before it posts, and /api/sms-opt-in runs them again on the
 * server, so the two can never disagree about what counts as a valid opt-in.
 */

export const SMS_OPT_IN_NAME_MAX_LENGTH = 120;

/**
 * A US mobile number to its 10 digits, or null. Accepts the usual ways people type one:
 * "(559) 512-0372", "559-512-0372", "559.512.0372", "5595120372", "+1 559 512 0372". A plus sign
 * is accepted only at the start and only for +1.
 * Area code and exchange can't start with 0 or 1 (North American Numbering Plan).
 */
export function normalizeOptInPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+?[\d\s().-]{10,20}$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  // A leading + means a country code follows: only +1 (US) is accepted, never a 10-digit
  // foreign number such as +47 923 45 678 read as if it were a US one.
  if (trimmed.startsWith("+") && !(digits.length === 11 && digits.startsWith("1"))) return null;
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return digits;
}

/** 10 digits as "(559) 512-0372". */
export function formatOptInPhone(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export type SmsOptInField = "name" | "phone" | "consent";

export type SmsOptInValidation =
  | { ok: true; value: { name?: string; phone: string } }
  | { ok: false; errors: Partial<Record<SmsOptInField, string>> };

export const SMS_OPT_IN_ERRORS = {
  phone: "Enter a 10-digit US mobile number, for example (559) 512-0372.",
  consent: "Check the box to agree to receive text messages before you submit.",
  name: `Keep your name or business name under ${SMS_OPT_IN_NAME_MAX_LENGTH} characters.`,
} as const;

/**
 * The form's rules: a valid US mobile number, and the consent box ticked (only `true` counts,
 * never a string or a missing value). The name or business name is optional.
 */
export function validateSmsOptIn(input: { name?: unknown; phone?: unknown; consent?: unknown }): SmsOptInValidation {
  const errors: Partial<Record<SmsOptInField, string>> = {};
  const rawName = typeof input.name === "string" ? input.name.replace(/\s+/g, " ").trim() : "";
  if (rawName.length > SMS_OPT_IN_NAME_MAX_LENGTH) errors.name = SMS_OPT_IN_ERRORS.name;
  const phone = normalizeOptInPhone(input.phone);
  if (!phone) errors.phone = SMS_OPT_IN_ERRORS.phone;
  if (input.consent !== true) errors.consent = SMS_OPT_IN_ERRORS.consent;
  if (!phone || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { phone, ...(rawName ? { name: rawName } : {}) } };
}
