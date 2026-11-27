/**
 * Server-side checks for marketing copy Cerebro drafts for a loan officer (bio, Google Business
 * Profile text, blog post, emails). The model is told these rules too, but the server is the
 * gate: a draft that fails comes back to the model as a list of problems to fix, and nothing is
 * saved until it passes.
 *
 * What is checked (mortgage advertising basics, not legal advice):
 * - No rate, APR or percentage figures (Reg Z / MAP trigger terms), no payment or down-payment
 *   dollar amounts.
 * - No guarantees or approval promises, no hype or false urgency.
 * - No invented track record: a count of years, loans, families, clients or reviews must match a
 *   number the officer gave in `facts`.
 * - No NMLS number other than the one the officer typed.
 */

const BANNED_PHRASES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bguarantee(d|s)?\b/i, label: "a guarantee" },
  { pattern: /\b(lowest|best|cheapest)\s+(rates?|prices?|deals?|terms?)\b/i, label: "a best/lowest rate claim" },
  { pattern: /\bno\s+credit\s+check\b/i, label: '"no credit check"' },
  { pattern: /\b(pre-?approved|approved|close[ds]?)\s+(in|within)\s+\d+/i, label: "an approval or closing timeline promise" },
  { pattern: /\beveryone\s+(qualifies|gets\s+approved)\b/i, label: "an approval promise" },
  {
    pattern: /\b(act\s+now|limited[\s-]+time|don['\u2019]?t\s+miss\s+out|hurry|before\s+(?:it['\u2019]?s|they['\u2019]?re)\s+gone|while\s+(?:it|they|supplies)\s+lasts?)\b/i,
    label: "false urgency",
  },
  { pattern: /\b(explode|skyrocket|crush)\b/i, label: "hype language" },
  { pattern: /\b#\s?1\b|\bnumber\s+one\b/i, label: 'a "#1" claim' },
];

const PERCENT = /\b\d{1,3}(?:\.\d{1,3})?\s?%|\b\d{1,3}(?:\.\d{1,3})?\s?percent\b/i;
const APR_WORD = /\bAPR\b/;
const PAYMENT_AMOUNT = /\$\s?\d[\d,]*(?:\.\d+)?\s*(?:(?:\/|per|a|each)\s*(?:mo\b|month)|monthly\b)/i;
// The same claim with the words first: "monthly payments starting at $1,200", "payment of $1,900".
const PAYMENT_AMOUNT_AFTER = /\b(?:payments?|per\s+month|a\s+month|monthly)\b[^.!?\n$]{0,40}\$\s?\d/i;
const DOWN_PAYMENT_AMOUNT = /\b(?:down\s+payment|put\s+down)\s+(?:of\s+|as\s+low\s+as\s+|just\s+)?\$\s?\d/i;
const TRACK_RECORD =
  /\b(\d[\d,]*)\s*\+?\s+(?:years?\s+(?:of\s+experience|in\s+(?:the\s+)?(?:business|industry|lending|mortgage)|helping|serving)|loans?\s+(?:closed|funded)|families|clients|homeowners|homebuyers|borrowers|reviews|five-star|5-star|transactions|closings)\b/gi;
const NMLS_NUMBER = /\bNMLS\s*(?:ID|#|No\.?|number)?\s*:?\s*#?\s*(\d{3,10})/gi;

export interface ComplianceInput {
  /** Field name to text, e.g. { bio: "..." }. */
  fields: Record<string, string>;
  /** Facts the officer stated about themselves (years in business, loans closed...). */
  facts?: string;
  /** The officer's NMLS ID when they typed it. */
  nmlsId?: string;
}

/** Problems as short, fixable sentences ("bio: remove the rate or percentage figure"). Empty when the copy passes. */
export function checkMarketingCompliance(input: ComplianceInput): string[] {
  const problems: string[] = [];
  const factNumbers = new Set((input.facts ?? "").match(/\d[\d,]*/g)?.map((n) => n.replace(/,/g, "")) ?? []);

  for (const [field, text] of Object.entries(input.fields)) {
    if (!text) continue;
    if (PERCENT.test(text) || APR_WORD.test(text)) {
      problems.push(`${field}: remove every rate, APR or percentage figure (advertising trigger term).`);
    }
    if (PAYMENT_AMOUNT.test(text) || PAYMENT_AMOUNT_AFTER.test(text) || DOWN_PAYMENT_AMOUNT.test(text)) {
      problems.push(`${field}: remove payment or down-payment dollar amounts (advertising trigger term).`);
    }
    for (const { pattern, label } of BANNED_PHRASES) {
      if (pattern.test(text)) problems.push(`${field}: remove ${label}.`);
    }
    for (const match of text.matchAll(TRACK_RECORD)) {
      const number = match[1].replace(/,/g, "");
      if (!factNumbers.has(number)) {
        problems.push(`${field}: "${match[0].trim()}" is not something the officer told you. Remove it or use only facts they gave.`);
      }
    }
    for (const match of text.matchAll(NMLS_NUMBER)) {
      if (!input.nmlsId || match[1] !== input.nmlsId) {
        problems.push(`${field}: do not write an NMLS number yourself; the server adds the officer's real one.`);
      }
    }
  }
  return [...new Set(problems)];
}

/** NMLS IDs are numeric, up to 7 digits today; allow a little headroom. */
export function cleanNmlsId(raw: unknown): string | undefined {
  if (typeof raw !== "string" && typeof raw !== "number") return undefined;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 3 && digits.length <= 8 ? digits : undefined;
}
