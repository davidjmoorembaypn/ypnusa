/**
 * Automated screen for common problems in mortgage marketing copy. It flags
 * wording a compliance officer would likely stop; it is NOT legal advice and
 * never replaces a company's own compliance review. Pure and deterministic so
 * it can run in the browser and in tests, with no network or AI call.
 *
 * Severity: "fix" = should change before use; "review" = needs a human decision.
 */

export type MarketingChannelKind = "social" | "email" | "sms" | "ad";

export interface ComplianceFinding {
  id: string;
  severity: "fix" | "review";
  message: string;
  /** The text that triggered the finding, when there is one. */
  matched?: string;
}

export interface ComplianceResult {
  /** True when nothing needs fixing. "review" items can remain. */
  readyForReview: boolean;
  findings: ComplianceFinding[];
}

interface PatternRule {
  id: string;
  severity: ComplianceFinding["severity"];
  pattern: RegExp;
  message: string;
}

const PATTERN_RULES: PatternRule[] = [
  {
    id: "guaranteed_approval",
    severity: "fix",
    pattern:
      /\b(guarantee[sd]?\s+(an?\s+)?(approval|approved|loan|closing|rate|funding)|100%\s*(approval|approved)|everyone\s+(is\s+)?(approved|qualifies)|no\s+(one|borrower)\s+(is\s+)?(denied|turned\s+down)|instant\s+approval)\b/i,
    message:
      "Do not promise or imply approval. No loan is guaranteed, and these claims can be treated as deceptive.",
  },
  {
    id: "superlative_rate_claim",
    severity: "fix",
    pattern: /\b(lowest|best|cheapest|unbeatable)\s+(mortgage\s+)?(rates?|prices?|payments?|deals?)\b/i,
    message: "Superlative rate or price claims are hard to prove and often challenged. Remove or substantiate.",
  },
  {
    id: "no_cost_claim",
    severity: "review",
    pattern: /\b(no\s+(closing\s+costs?|fees?|cost)|free\s+(money|down\s*payment|home)|zero\s+(down|cost))\b/i,
    message:
      "\"No cost\", \"free money\" and \"zero down\" style claims need a precise, accurate explanation of who pays what.",
  },
  {
    id: "preapproved_wording",
    severity: "review",
    pattern: /\bpre-?approv(ed|al)\b/i,
    message:
      "\"Pre-approved\" implies a credit decision. Use \"get pre-qualified\" unless you are actually issuing a pre-approval.",
  },
  {
    id: "government_affiliation",
    severity: "review",
    pattern:
      /\b((hud|fha|va|usda|fannie\s*mae|freddie\s*mac)[\s-]+(approved|endorsed|sponsored|backed\s+by)|official\s+(government|federal|va|fha)|government\s+(program|loan)\s+approved)\b/i,
    message:
      "Do not suggest a government agency endorses or is affiliated with you or your offer. State program facts neutrally.",
  },
  {
    id: "urgency_pressure",
    severity: "review",
    pattern: /\b(act\s+now|limited\s+time|rates?\s+(are\s+)?(going|about\s+to\s+go)\s+up|before\s+it'?s\s+too\s+late|last\s+chance)\b/i,
    message: "Pressure or scarcity wording about rates or availability needs to be accurate and supportable.",
  },
  {
    id: "results_guarantee",
    severity: "review",
    pattern: /\b(guaranteed\s+(results?|income|savings)|you\s+will\s+(save|earn)\s+\$)/i,
    message: "Avoid guaranteeing results, savings or income. Describe what the product does, not what it will earn.",
  },
  {
    id: "fair_housing_preference",
    severity: "fix",
    pattern:
      /\b((no|not\s+for)\s+(kids|children|families)|(adults|seniors|singles|couples|christians?|muslims?|jewish|whites?|blacks?|hispanics?|asians?)\s+(only|preferred)|(ideal|perfect)\s+for\s+(young\s+)?(singles|couples|christians?|whites?))\b/i,
    message:
      "This can read as a preference or limitation based on a protected class (Fair Housing / ECOA). Rewrite to describe the offer, not who it is for.",
  },
  {
    id: "sensitive_number",
    severity: "fix",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    message: "This looks like a Social Security number. Never put personal identifiers in marketing copy.",
  },
];

/** A rate, payment or down-payment figure can trigger extra Regulation Z advertising disclosures. */
const TRIGGER_TERM =
  /(\d+(\.\d+)?\s*%\s*(apr|interest|rate|down)|\bas\s+low\s+as\s+\d|\$\s?\d[\d,]*(\.\d+)?\s*(\/|per|a)\s*(mo|month)|\b\d+\s*%\s*down\b|\b(rates?|payments?)\s+(from|starting|as\s+low\s+as)\s+\$?\d)/i;

const NMLS = /nmls\s*(id|#|no\.?|number)?\s*[:#]?\s*\d{4,}/i;
const EQUAL_HOUSING = /equal\s+housing/i;
const UNSUBSCRIBE = /\b(unsubscribe|opt[\s-]?out|manage\s+(your\s+)?preferences)\b/i;
const SMS_STOP = /\b(reply\s+)?stop\b/i;
const POSTAL_ADDRESS = /\b\d{1,6}\s+[A-Za-z0-9.\s]+,\s*[A-Za-z.\s]+,?\s*[A-Z]{2}\s+\d{5}\b/;

export function checkMarketingCompliance(
  rawText: string,
  channel: MarketingChannelKind = "social",
): ComplianceResult {
  const text = rawText.trim();
  const findings: ComplianceFinding[] = [];

  if (!text) {
    return {
      readyForReview: false,
      findings: [{ id: "empty", severity: "fix", message: "Paste or write some copy to check." }],
    };
  }

  for (const rule of PATTERN_RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      findings.push({ id: rule.id, severity: rule.severity, message: rule.message, matched: match[0] });
    }
  }

  const trigger = text.match(TRIGGER_TERM);
  if (trigger) {
    findings.push({
      id: "trigger_terms",
      severity: "review",
      message:
        "Stating a rate, payment or down-payment figure can require additional disclosures under Regulation Z (for example the APR and key terms). Have compliance confirm the full disclosure is present.",
      matched: trigger[0],
    });
  }

  if (!NMLS.test(text)) {
    findings.push({
      id: "missing_nmls",
      severity: "fix",
      message:
        "Add your NMLS ID. Most states and companies require it on mortgage marketing; confirm your company's policy.",
    });
  }
  if (!EQUAL_HOUSING.test(text)) {
    findings.push({
      id: "missing_equal_housing",
      severity: "review",
      message: "Add an Equal Housing Opportunity statement if your company's advertising policy requires it.",
    });
  }

  if (channel === "email") {
    if (!UNSUBSCRIBE.test(text)) {
      findings.push({
        id: "email_missing_unsubscribe",
        severity: "fix",
        message: "Marketing email needs a working unsubscribe/opt-out (CAN-SPAM).",
      });
    }
    if (!POSTAL_ADDRESS.test(text)) {
      findings.push({
        id: "email_missing_address",
        severity: "review",
        message: "Marketing email should include a valid physical postal address (CAN-SPAM).",
      });
    }
  }

  if (channel === "sms" && !SMS_STOP.test(text)) {
    findings.push({
      id: "sms_missing_stop",
      severity: "fix",
      message: "Marketing text messages need opt-out language such as \"Reply STOP to opt out\" (TCPA), and you need prior written consent.",
    });
  }

  findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "fix" ? -1 : 1));
  return { readyForReview: !findings.some((finding) => finding.severity === "fix"), findings };
}
