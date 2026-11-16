/**
 * Disclosure rules for mortgage marketing, by state. Code side only: this is NOT legal
 * advice. A state's extra lines are only ever ADDED to the federal baseline, so a drafted
 * rule is applied right away, but until a compliance professional confirms its wording
 * (`reviewed: true`) every result for that state carries a "verify" warning. A state with
 * no rule gets the federal baseline plus a warning.
 *
 * Federal baseline (every state, every channel):
 * - The loan officer's name and individual NMLS ID (SAFE Act; most states' ad rules).
 * - The company's NMLS ID, when the officer gave one.
 * - "Equal Housing Opportunity" (brokers) or "Equal Housing Lender" (lenders), on every
 *   channel except short texts, where the character budget goes to identity + opt-out.
 */

export type ComplianceChannel = "sms" | "email" | "ai_message" | "social_caption" | "landing_footer";

/** License kinds the engine knows how to print. Free-form "other" still counts for state coverage. */
export type OfficerLicenseType = "mlo" | "ca_dre" | "ca_dfpi_cfl" | "other";

export interface OfficerLicense {
  /** Two-letter state, upper case. */
  state: string;
  type: OfficerLicenseType;
  /** License number as issued (printed for types that require it). */
  number?: string;
}

export interface StateRule {
  state: string;
  /** Set to true once a compliance professional has confirmed this state's wording. */
  reviewed: boolean;
  /** Extra lines for this state, built from the officer's license for that state. */
  disclosures: (license: OfficerLicense | undefined) => string[];
}

/**
 * California. Drafted from the California DRE and DFPI advertising requirements (DRE
 * license number alongside the NMLS ID; the CFL loans-made-or-arranged statement).
 * reviewed: false until a compliance reviewer confirms the wording.
 */
const CALIFORNIA: StateRule = {
  state: "CA",
  reviewed: false,
  disclosures: (license) => {
    if (!license) return [];
    if (license.type === "ca_dre" && license.number) return [`CA DRE #${license.number}`];
    if (license.type === "ca_dfpi_cfl") {
      return ["Loans made or arranged pursuant to a California Financing Law license."];
    }
    return [];
  },
};

export const STATE_RULES: Readonly<Record<string, StateRule>> = {
  CA: CALIFORNIA,
};

/** True when the rule for a state exists and has been reviewed. */
export function stateRuleIsLive(state: string): boolean {
  return STATE_RULES[state]?.reviewed === true;
}
