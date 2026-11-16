import { STATE_RULES, type ComplianceChannel, type OfficerLicense } from "./rules";
import { zipToState } from "./zip-state";

/**
 * applyComplianceGuardrails(): adds the disclosures a mortgage message needs before it
 * goes out (or before a page renders), and refuses messages that should not go out at all.
 *
 * - Every message needs the loan officer's NMLS ID. Without one the result is blocked.
 * - When the officer has recorded their state licenses and the borrower's state (from
 *   `state` or the ZIP code) is not one of them, the result is blocked: an officer may
 *   not market a loan in a state where they are not licensed.
 * - Otherwise it appends the federal baseline plus any state lines (see rules.ts),
 *   skipping any disclosure the text already contains, so running it twice is a no-op.
 *
 * Pure: no I/O, no AI call. Not legal advice; see rules.ts for review status.
 */

export interface ComplianceOfficer {
  name: string;
  nmlsId?: string;
  company?: string;
  companyNmlsId?: string;
  licenses?: OfficerLicense[];
  /** Brokers say "Equal Housing Opportunity", lenders "Equal Housing Lender". Default opportunity. */
  equalHousing?: "opportunity" | "lender";
}

export interface ComplianceInput {
  text: string;
  channel: ComplianceChannel;
  officer: ComplianceOfficer;
  /** The borrower's ZIP code, when known. */
  zip?: string;
  /** The borrower's state (two letters); wins over the ZIP code. */
  state?: string;
}

export type ComplianceBlockReason = "missing_nmls" | "not_licensed_in_state";
export type ComplianceWarning = "state_unknown" | "license_states_unknown" | "state_rule_unreviewed" | "no_state_rule" | "sms_too_long";

export interface ComplianceResult {
  /** The text with disclosures added (unchanged when blocked). */
  text: string;
  /** Disclosure lines this call added (empty when they were already present). */
  appended: string[];
  blocked: boolean;
  reasons: ComplianceBlockReason[];
  warnings: ComplianceWarning[];
  /** The state the rules were applied for, when known. */
  state?: string;
}

const SMS_SOFT_LIMIT = 320; // two SMS segments
const STOP_LINE = /\s*Reply STOP to opt out\.?\s*$/i;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s#:.,]+/g, " ").trim();
}

function alreadyHas(text: string, line: string): boolean {
  return normalize(text).includes(normalize(line));
}

/** True when the text already shows this NMLS number in any common form ("NMLS #123", "NMLS ID: 123"). */
function hasNmls(text: string, nmlsId: string): boolean {
  const escaped = nmlsId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`NMLS[^0-9\\[]{0,12}${escaped}(?![0-9])`, "i").test(text);
}

/**
 * Footer lines for an officer's own page: company NMLS, each licensed state's extra lines
 * and the states they are licensed in. The page prints name, NMLS ID and Equal Housing itself.
 */
export function officerLicenseLines(officer: ComplianceOfficer): string[] {
  const lines: string[] = [];
  if (officer.company && officer.companyNmlsId) lines.push(`${officer.company}, NMLS #${officer.companyNmlsId}`);
  for (const license of officer.licenses ?? []) {
    const rule = STATE_RULES[license.state];
    if (rule) lines.push(...rule.disclosures(license));
  }
  const states = [...new Set((officer.licenses ?? []).map((item) => item.state))].sort();
  if (states.length > 0) lines.push(`Licensed in ${states.join(", ")}`);
  return lines;
}

/** The disclosure lines for an officer, before checking what the text already has. */
export function requiredDisclosures(
  officer: ComplianceOfficer,
  channel: ComplianceChannel,
  state: string | undefined,
): string[] {
  const lines: string[] = [];
  if (officer.nmlsId) lines.push(`${officer.name}, NMLS #${officer.nmlsId}`);
  if (officer.company && officer.companyNmlsId) lines.push(`${officer.company}, NMLS #${officer.companyNmlsId}`);
  if (state) {
    const rule = STATE_RULES[state];
    const license = officer.licenses?.find((item) => item.state === state);
    if (rule) lines.push(...rule.disclosures(license));
  }
  if (channel !== "sms") lines.push(officer.equalHousing === "lender" ? "Equal Housing Lender" : "Equal Housing Opportunity");
  return lines;
}

export function applyComplianceGuardrails(input: ComplianceInput): ComplianceResult {
  const { officer, channel } = input;
  const state = (input.state?.trim().toUpperCase() || zipToState(input.zip ?? "")) ?? undefined;
  const reasons: ComplianceBlockReason[] = [];
  const warnings: ComplianceWarning[] = [];

  if (!officer.nmlsId) reasons.push("missing_nmls");

  const licensedStates = (officer.licenses ?? []).map((item) => item.state.toUpperCase());
  if (state && licensedStates.length > 0 && !licensedStates.includes(state)) reasons.push("not_licensed_in_state");
  if (!state && channel !== "landing_footer") warnings.push("state_unknown");
  if (licensedStates.length === 0) warnings.push("license_states_unknown");
  if (state) {
    const rule = STATE_RULES[state];
    if (!rule) warnings.push("no_state_rule");
    else if (!rule.reviewed) warnings.push("state_rule_unreviewed");
  }

  if (reasons.length > 0) {
    return { text: input.text, appended: [], blocked: true, reasons, warnings, ...(state ? { state } : {}) };
  }

  const appended = requiredDisclosures(officer, channel, state).filter((line) => {
    if (officer.nmlsId && line === `${officer.name}, NMLS #${officer.nmlsId}` && hasNmls(input.text, officer.nmlsId)) return false;
    if (officer.companyNmlsId && line.endsWith(`NMLS #${officer.companyNmlsId}`) && hasNmls(input.text, officer.companyNmlsId)) return false;
    return !alreadyHas(input.text, line);
  });

  let text = input.text;
  if (appended.length > 0) {
    if (channel === "sms") {
      // Keep the opt-out line last: "...message. Jane Doe, NMLS #123. Reply STOP to opt out."
      const stop = STOP_LINE.exec(text);
      const body = stop ? text.slice(0, stop.index) : text;
      text = `${body.trimEnd()} ${appended.join(". ")}.${stop ? " Reply STOP to opt out." : ""}`;
    } else {
      text = `${text.trimEnd()}\n\n${appended.join("\n")}`;
    }
  }
  if (channel === "sms" && text.length > SMS_SOFT_LIMIT) warnings.push("sms_too_long");

  return { text, appended, blocked: false, reasons, warnings, ...(state ? { state } : {}) };
}

/** Plain-English reason, for showing to the officer or returning to Cerebro. */
export function describeBlock(reason: ComplianceBlockReason, state?: string): string {
  return reason === "missing_nmls"
    ? "Add your NMLS ID to your profile first; every mortgage message must show it."
    : `You haven't listed a license in ${state ?? "this borrower's state"}, so this can't go out there.`;
}
