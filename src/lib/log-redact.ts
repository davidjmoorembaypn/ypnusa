import { inspect } from "node:util";

/**
 * Keeps borrower personal data out of server logs. Server logs are read by people and
 * tools that never need a borrower's email or phone, and they are kept longer and copied
 * more freely than the data file.
 *
 * installConsoleRedaction() wraps console.log/info/warn/error/debug once at startup (see
 * src/instrumentation.ts), so every existing and future log line is covered, including
 * errors thrown by provider SDKs that echo request bodies.
 */

const PATTERNS: Array<{ pattern: RegExp; replace: string }> = [
  // Encrypted field values are not secret, but they are long and add nothing to a log.
  { pattern: /enc:v1:[A-Za-z0-9+/=:]+/g, replace: "[encrypted]" },
  // Bearer tokens and API keys in headers or query strings.
  { pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replace: "$1 [redacted]" },
  {
    pattern: /\b(api[_-]?key|token|secret|password|authorization)(["']?\s*[:=]\s*["']?)[^\s"'&,}]{4,}/gi,
    replace: "$1$2[redacted]",
  },
  { pattern: /\b(sk|pk|rk|whsec)_(live|test)_[A-Za-z0-9]{8,}/g, replace: "[redacted-key]" },
  // Emails.
  { pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replace: "[email]" },
  // US social security numbers.
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replace: "[ssn]" },
  // Card, bank account and other long digit runs (9+ digits, spaces/dashes allowed).
  { pattern: /\b\d(?:[ -]?\d){8,18}\b/g, replace: "[number]" },
  // Phone numbers: +1 (559) 555-0100, 559.555.0100, 5595550100.
  { pattern: /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, replace: "[phone]" },
];

/** Masks emails, phone numbers, SSNs, long account-like numbers and credentials in text. */
export function redact(text: string): string {
  let out = text;
  for (const { pattern, replace } of PATTERNS) out = out.replace(pattern, replace);
  return out;
}

/** Redacts one console argument. Errors keep their name and stack (redacted). */
export function redactLogArg(arg: unknown): unknown {
  if (typeof arg === "string") return redact(arg);
  if (arg instanceof Error) {
    const text = arg.stack ?? `${arg.name}: ${arg.message}`;
    return redact(text);
  }
  if (arg === null || typeof arg !== "object") return arg;
  // Objects are printed by inspect() anyway; redact that text instead of trusting the object.
  return redact(inspect(arg, { depth: 4, breakLength: Infinity }));
}

const METHODS = ["log", "info", "warn", "error", "debug"] as const;
let installed = false;

/** Wraps console methods so every argument is redacted. Safe to call more than once. */
export function installConsoleRedaction(target: Pick<Console, (typeof METHODS)[number]> = console): void {
  if (target === console) {
    if (installed) return;
    installed = true;
  }
  for (const method of METHODS) {
    const original = target[method].bind(target);
    target[method] = (...args: unknown[]) => original(...args.map(redactLogArg));
  }
}
