/**
 * ZIP code text helpers with no dependencies, so the data store, the repositories and the
 * territory logic can all share them without importing one another.
 */

/** Digits only, at most five: "93618-1234" and " 93618 " both become "93618". */
export function normalizeZip(raw: unknown): string {
  if (typeof raw !== "string" && typeof raw !== "number") return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}
