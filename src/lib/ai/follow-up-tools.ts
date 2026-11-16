import { borrowerFacingOfficer, houseOfficerRecord, HOUSE_OFFICER_ID } from "@/lib/crm";
import { applyComplianceGuardrails, describeBlock, type ComplianceOfficer } from "@/lib/compliance/guardrails";
import { appendCrmNote, readDb, saveCerebroAction, writeDb } from "@/lib/db";
import { generateId } from "@/lib/id";
import type {
  BorrowerLeadRecord,
  CerebroQueuedActionRecord,
  ChatSessionRecord,
  LoanOfficerRecord,
  PrequalRequest,
} from "@/lib/types";
import { checkMarketingCompliance } from "./marketing-compliance";
import type { AiToolCall, AiToolDefinition } from "./provider";

/**
 * Cerebro as the loan officer's follow-up assistant. It does the busy work of deciding who needs a
 * touch and writing the message, but every borrower-facing message is a DRAFT in the officer's
 * approval queue (cerebroActions, status awaiting_approval). Nothing here sends a text, email or
 * call. Drafts go only to borrowers who gave contact consent, texts carry "Reply STOP to opt out",
 * and no draft contains a rate, APR, payment amount or approval promise.
 */

// ---------------------------------------------------------------- borrower-facing (public chat)

export const BORROWER_FOLLOW_UP_TOOL_NAMES = new Set(["subscribe_rate_alerts", "save_prequal_details"]);

export const SUBSCRIBE_RATE_ALERTS_TOOL: AiToolDefinition = {
  name: "subscribe_rate_alerts",
  description:
    "Sign a qualified borrower up to hear from their loan officer when mortgage rates move (useful for someone waiting to buy or refinance). Only after they clearly said yes to rate alerts and to the channel. Their loan officer approves every alert before it goes out. Never quote a rate.",
  inputSchema: {
    type: "object",
    properties: {
      channel: { type: "string", enum: ["text", "email"] },
      optOut: { type: "boolean", description: "True if they asked to stop rate alerts." },
    },
    required: ["channel"],
    additionalProperties: false,
  },
};

export const SAVE_PREQUAL_DETAILS_TOOL: AiToolDefinition = {
  name: "save_prequal_details",
  description:
    "When a qualified buyer wants a prequalification letter, record what they shared (self-reported ranges only) and send the request to their loan officer, who reviews it and issues the letter. Ask one or two questions at a time: target price, down payment plan, rough credit range, employment type, rough monthly income, which documents they have ready (pay stubs, W-2s, tax returns, bank statements). Never ask for a Social Security number, date of birth, or account numbers. Never say they are prequalified or approved: the loan officer decides.",
  inputSchema: {
    type: "object",
    properties: {
      targetPrice: { type: "string", description: "e.g. 'around $400k'" },
      downPayment: { type: "string", description: "e.g. '5%, from savings' or 'not sure'" },
      creditRange: { type: "string", enum: ["excellent", "good", "fair", "rebuilding", "unsure"] },
      employment: { type: "string", enum: ["w2", "self_employed", "retired", "other"] },
      monthlyIncomeRange: { type: "string", description: "Self-reported, e.g. '$6-8k before taxes'." },
      docsReady: { type: "array", items: { type: "string" } },
      notes: { type: "string" },
    },
    additionalProperties: false,
  },
};

function str(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Strips anything that looks like an SSN, card or account number before it is stored. */
function scrubSensitive(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, "[removed]").replace(/\b\d{9,}\b/g, "[removed]");
}

function linkedLead(session: ChatSessionRecord): BorrowerLeadRecord | { error: string } {
  if (!session.borrowerLeadId || session.capturedFields.consent !== true) {
    return { error: "not_yet_qualified" };
  }
  const lead = readDb().borrowerLeads.find((item) => item.id === session.borrowerLeadId);
  return lead ?? { error: "lead_not_found" };
}

export function executeSubscribeRateAlerts(call: AiToolCall, session: ChatSessionRecord): string {
  const lead = linkedLead(session);
  if ("error" in lead) return JSON.stringify({ error: lead.error, note: "Get their name, contact and consent first." });
  const channel = call.input.channel;
  if (channel !== "text" && channel !== "email") return JSON.stringify({ error: "channel must be text or email." });
  const f = session.capturedFields;
  if (channel === "text" && !f.phone) return JSON.stringify({ error: "phone_missing" });
  if (channel === "email" && !f.email) return JSON.stringify({ error: "email_missing" });
  const now = new Date().toISOString();
  const optOut = call.input.optOut === true;
  writeDb((db) => {
    const stored = db.borrowerLeads.find((item) => item.id === lead.id);
    if (!stored) return;
    stored.rateAlerts = optOut
      ? { channel, optedInAt: stored.rateAlerts?.optedInAt ?? now, optedOutAt: now }
      : { channel, optedInAt: now };
  });
  appendCrmNote(lead.id, optOut ? "Cerebro: borrower opted out of rate alerts." : `Cerebro: borrower opted in to rate alerts by ${channel}.`);
  return JSON.stringify({
    saved: true,
    note: optOut
      ? "Opted out. Confirm plainly that they will not get rate alerts."
      : "Signed up. Tell them their loan officer will reach out when rates move, and they can say stop any time. Never quote a rate.",
  });
}

export function executeSavePrequalDetails(call: AiToolCall, session: ChatSessionRecord): string {
  const lead = linkedLead(session);
  if ("error" in lead) return JSON.stringify({ error: lead.error, note: "Get their name, contact and consent first." });
  const input = call.input;
  const creditRanges = new Set(["excellent", "good", "fair", "rebuilding", "unsure"]);
  const employments = new Set(["w2", "self_employed", "retired", "other"]);
  const request: PrequalRequest = {
    requestedAt: new Date().toISOString(),
    targetPrice: scrubSensitive(str(input.targetPrice, 60)),
    downPayment: scrubSensitive(str(input.downPayment, 80)),
    creditRange: creditRanges.has(input.creditRange as string) ? (input.creditRange as PrequalRequest["creditRange"]) : undefined,
    employment: employments.has(input.employment as string) ? (input.employment as PrequalRequest["employment"]) : undefined,
    monthlyIncomeRange: scrubSensitive(str(input.monthlyIncomeRange, 60)),
    docsReady: Array.isArray(input.docsReady)
      ? input.docsReady.map((doc) => scrubSensitive(str(doc, 40))).filter((doc): doc is string => Boolean(doc)).slice(0, 8)
      : undefined,
    notes: scrubSensitive(str(input.notes, 300)),
  };
  writeDb((db) => {
    const stored = db.borrowerLeads.find((item) => item.id === lead.id);
    if (stored) stored.prequalRequest = request;
  });

  const summary = [
    request.targetPrice && `target price ${request.targetPrice}`,
    request.downPayment && `down payment ${request.downPayment}`,
    request.creditRange && `credit ${request.creditRange}`,
    request.employment && `employment ${request.employment.replace("_", " ")}`,
    request.monthlyIncomeRange && `income ${request.monthlyIncomeRange}`,
    request.docsReady?.length && `docs ready: ${request.docsReady.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");
  const now = request.requestedAt;
  const existing = readDb().cerebroActions.find(
    (action) => action.borrowerLeadId === lead.id && action.kind === "prequal_request" && action.status === "awaiting_approval",
  );
  saveCerebroAction({
    id: existing?.id ?? generateId("cba"),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    loId: lead.assignedLoId,
    borrowerLeadId: lead.id,
    kind: "prequal_request",
    status: "awaiting_approval",
    channel: session.capturedFields.email ? "email" : "text",
    body: `${session.capturedFields.name ?? "The borrower"} asked for a prequal letter. Self-reported: ${summary || "no details yet"}. Review, then ask Cerebro to draft the letter with the amount you approve.`,
    source: "public_chat",
  });
  if (!existing) appendCrmNote(lead.id, `Cerebro: prequal letter requested (${summary || "details pending"}).`);
  return JSON.stringify({
    saved: true,
    note: "Sent to their loan officer, who reviews it and issues the letter. Do not say they are prequalified. Tell them what documents usually help if they have not listed them.",
  });
}

// ---------------------------------------------------------------- officer-facing (dashboard chat)

export const OFFICER_FOLLOW_UP_TOOL_NAMES = new Set(["run_follow_ups", "draft_rate_alerts", "draft_prequal_letter"]);

export const RUN_FOLLOW_UPS_TOOL: AiToolDefinition = {
  name: "run_follow_ups",
  description:
    "Do the follow-up busy work for the officer: find their borrowers who consented to contact and have had no Cerebro touch in the last week, and draft a short check-in for each (purchase: offer a prequal letter; refinance: offer a no-cost review; others: a friendly check-in) into their approval queue. Nothing is sent. Call when they ask you to follow up, chase leads, or work their pipeline.",
  inputSchema: {
    type: "object",
    properties: {
      maxLeads: { type: "integer", minimum: 1, maximum: 25, description: "How many drafts at most. Default 10." },
      quietDays: { type: "integer", minimum: 2, maximum: 60, description: "Skip leads touched within this many days. Default 7." },
    },
    additionalProperties: false,
  },
};

export const DRAFT_RATE_ALERTS_TOOL: AiToolDefinition = {
  name: "draft_rate_alerts",
  description:
    "When the officer says rates moved (or asks to tell their rate-watch borrowers), draft a short 'rates have moved, want fresh numbers?' note to every one of their borrowers who opted in to rate alerts, into the approval queue. The drafts never contain a rate or APR; an optional officer note is checked for that too. Nothing is sent.",
  inputSchema: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["down", "up", "moved"], description: "Which way rates went, per the officer. Default moved." },
      officerNote: { type: "string", description: "One optional sentence in the officer's words, no numbers." },
    },
    additionalProperties: false,
  },
};

export const DRAFT_PREQUAL_LETTER_TOOL: AiToolDefinition = {
  name: "draft_prequal_letter",
  description:
    "Draft a prequalification letter for one of the officer's own borrowers, using ONLY the amount, program and expiry the officer gives you after their own review. Adds the officer's NMLS ID and the standard 'not a commitment to lend' language. Saved as a draft in their queue for them to sign and send. Never call it with an amount the officer did not state.",
  inputSchema: {
    type: "object",
    properties: {
      borrowerName: { type: "string", description: "As shown in their pipeline or queue." },
      maxPurchasePrice: { type: "integer", minimum: 10000, maximum: 10000000, description: "Dollars, as the officer stated." },
      loanProgram: { type: "string", enum: ["Conventional", "FHA", "VA", "USDA", "Jumbo", "DSCR", "Other"] },
      validDays: { type: "integer", minimum: 15, maximum: 120, description: "How long the letter is valid. Default 90." },
      propertyCity: { type: "string" },
    },
    required: ["borrowerName", "maxPurchasePrice", "loanProgram"],
    additionalProperties: false,
  },
};

export const OFFICER_FOLLOW_UP_TOOLS: AiToolDefinition[] = [RUN_FOLLOW_UPS_TOOL, DRAFT_RATE_ALERTS_TOOL, DRAFT_PREQUAL_LETTER_TOOL];

const DAY_MS = 24 * 60 * 60 * 1000;
const STOP_LINE = "Reply STOP to opt out.";

function borrowerFirstName(lead: BorrowerLeadRecord): string {
  return lead.answers.name?.trim().split(/\s+/)[0] || "there";
}

function facingOfficer(loId: string): LoanOfficerRecord {
  if (loId === HOUSE_OFFICER_ID) return houseOfficerRecord();
  const officer = readDb().loanOfficers.find((item) => item.id === loId);
  return officer ? borrowerFacingOfficer(officer) : houseOfficerRecord();
}

/** Text if they gave a phone, otherwise email; the rate-alert channel when they picked one. */
function channelFor(lead: BorrowerLeadRecord, preferred?: "text" | "email"): "text" | "email" | null {
  if (preferred === "text" && lead.answers.phone) return "text";
  if (preferred === "email" && lead.answers.email) return "email";
  if (lead.answers.phone) return "text";
  if (lead.answers.email) return "email";
  return null;
}

function goalOf(lead: BorrowerLeadRecord): "purchase" | "refinance" | "other" {
  if (lead.answers.purchaseRefiIntent === "refinance" || lead.answers.loanProgram === "REFI") return "refinance";
  if (lead.answers.purchaseRefiIntent === "purchase") return "purchase";
  return "other";
}

export function nudgeDraft(lead: BorrowerLeadRecord, officer: LoanOfficerRecord, channel: "text" | "email"): { subject?: string; body: string } {
  const first = borrowerFirstName(lead);
  const goal = goalOf(lead);
  const ask =
    goal === "purchase"
      ? "Want me to put together a prequalification letter so you're ready when you find the right home?"
      : goal === "refinance"
        ? "Want me to run a quick, no-cost review to see if refinancing makes sense for you right now?"
        : "Is there anything I can help you with on your home plans?";
  if (channel === "email") {
    return {
      subject: goal === "purchase" ? "Ready when you find the one" : goal === "refinance" ? "A quick refinance check" : "Checking in",
      body: `Hi ${first},\n\nIt's ${officer.name}, checking in. ${ask} Just reply to this email and we'll find a time that works, no obligation.\n\n${officer.name.split(/\s+/)[0]}`,
    };
  }
  return { body: `Hi ${first}, it's ${officer.name}, checking in. ${ask} ${STOP_LINE}` };
}

export function rateAlertDraft(
  lead: BorrowerLeadRecord,
  officer: LoanOfficerRecord,
  channel: "text" | "email",
  direction: "down" | "up" | "moved",
  officerNote?: string,
): { subject?: string; body: string } {
  const first = borrowerFirstName(lead);
  const moved = direction === "down" ? "Rates came down" : direction === "up" ? "Rates went up" : "Rates have moved";
  const goal = goalOf(lead);
  const offer = goal === "refinance" ? "Want me to see what that could mean for a refinance?" : "Want me to run fresh numbers for you?";
  const note = officerNote ? ` ${officerNote}` : "";
  if (channel === "email") {
    return {
      subject: `${moved}: want fresh numbers?`,
      body: `Hi ${first},\n\nYou asked me to let you know when mortgage rates move. ${moved} since we last talked.${note} ${offer} Just reply and I'll put them together, no obligation.\n\n${officer.name.split(/\s+/)[0]}\n\nTo stop rate alerts, reply "stop alerts".`,
    };
  }
  return { body: `Hi ${first}, it's ${officer.name}. ${moved} since we last talked.${note} ${offer} ${STOP_LINE}` };
}

function hasOpenDraft(actions: CerebroQueuedActionRecord[], leadId: string, kinds: CerebroQueuedActionRecord["kind"][]): boolean {
  return actions.some((action) => action.borrowerLeadId === leadId && action.status === "awaiting_approval" && kinds.includes(action.kind));
}

function lastTouch(actions: CerebroQueuedActionRecord[], lead: BorrowerLeadRecord): number {
  const times = actions.filter((action) => action.borrowerLeadId === lead.id).map((action) => Date.parse(action.updatedAt));
  return Math.max(Date.parse(lead.createdAt), ...times);
}

const NMLS_PLACEHOLDER = "[add your NMLS ID]";

export function complianceOfficerOf(officer: LoanOfficerRecord): ComplianceOfficer {
  return {
    name: officer.name,
    nmlsId: officer.nmlsId,
    company: officer.company,
    companyNmlsId: officer.companyNmlsId,
    licenses: officer.licenses,
    equalHousing: officer.equalHousing,
  };
}

/**
 * Adds the officer's required disclosures (NMLS ID, state lines, Equal Housing) to a
 * borrower-facing draft, via src/lib/compliance. Returns null when the officer is not
 * licensed in the borrower's state. A missing NMLS ID does not drop the draft: it gets a
 * visible placeholder the officer must fill in before approving, as prequal letters do.
 */
export function withDisclosures(
  lead: BorrowerLeadRecord,
  officer: LoanOfficerRecord,
  channel: "text" | "email",
  body: string,
): { body: string } | { blocked: string } {
  const run = (nmlsId: string | undefined) =>
    applyComplianceGuardrails({
      text: body,
      channel: channel === "text" ? "sms" : "email",
      officer: { ...complianceOfficerOf(officer), nmlsId },
      zip: lead.answers.zip,
    });
  let result = run(officer.nmlsId);
  if (result.blocked && result.reasons.includes("not_licensed_in_state")) {
    return { blocked: describeBlock("not_licensed_in_state", result.state) };
  }
  if (result.blocked) result = run(NMLS_PLACEHOLDER);
  return { body: result.text };
}

function queueDraft(
  lead: BorrowerLeadRecord,
  kind: CerebroQueuedActionRecord["kind"],
  channel: "text" | "email",
  draft: { subject?: string; body: string },
  officer: LoanOfficerRecord = facingOfficer(lead.assignedLoId),
): CerebroQueuedActionRecord | null {
  const checked = withDisclosures(lead, officer, channel, draft.body);
  if ("blocked" in checked) return null;
  draft = { ...draft, body: checked.body };
  const now = new Date().toISOString();
  const record: CerebroQueuedActionRecord = {
    id: generateId("cba"),
    createdAt: now,
    updatedAt: now,
    loId: lead.assignedLoId,
    borrowerLeadId: lead.id,
    kind,
    status: "awaiting_approval",
    channel,
    subject: draft.subject,
    body: draft.body,
    source: "follow_up_run",
  };
  saveCerebroAction(record);
  return record;
}

const CLOSED_STATUSES = /closed|lost|dead|funded|do_not_contact|unsubscribed/i;

export function executeRunFollowUps(call: AiToolCall, officer: LoanOfficerRecord): string {
  const maxLeads = Math.max(1, Math.min(25, typeof call.input.maxLeads === "number" ? Math.floor(call.input.maxLeads) : 10));
  const quietDays = Math.max(2, Math.min(60, typeof call.input.quietDays === "number" ? Math.floor(call.input.quietDays) : 7));
  const db = readDb();
  const crmStatus = new Map(db.crmLeads.map((crm) => [crm.borrowerLeadId, crm.status]));
  const actions = db.cerebroActions;
  const cutoff = Date.now() - quietDays * DAY_MS;
  const skipped = { noConsent: 0, recentlyTouched: 0, closed: 0, noContact: 0, notLicensedInState: 0 };
  const drafted: Array<{ borrower: string; channel: string; goal: string }> = [];

  const leads = db.borrowerLeads
    .filter((lead) => lead.assignedLoId === officer.id)
    .sort((a, b) => lastTouch(actions, a) - lastTouch(actions, b));
  for (const lead of leads) {
    if (drafted.length >= maxLeads) break;
    if (lead.answers.contactConsent !== true) { skipped.noConsent++; continue; }
    if (CLOSED_STATUSES.test(crmStatus.get(lead.id) ?? "")) { skipped.closed++; continue; }
    if (lastTouch(actions, lead) > cutoff || hasOpenDraft(actions, lead.id, ["nudge_draft", "follow_up_draft"])) {
      skipped.recentlyTouched++;
      continue;
    }
    const channel = channelFor(lead);
    if (!channel) { skipped.noContact++; continue; }
    const facing = facingOfficer(lead.assignedLoId);
    if (!queueDraft(lead, "nudge_draft", channel, nudgeDraft(lead, facing, channel), facing)) {
      skipped.notLicensedInState++;
      continue;
    }
    drafted.push({ borrower: lead.answers.name ?? "Unnamed lead", channel, goal: goalOf(lead) });
  }
  return JSON.stringify({
    drafted: drafted.length,
    items: drafted,
    skipped,
    note: "Drafts are in the approval queue (list_queued_actions). Nothing was sent.",
  });
}

export function executeDraftRateAlerts(call: AiToolCall, officer: LoanOfficerRecord): string {
  const direction = call.input.direction === "down" || call.input.direction === "up" ? call.input.direction : "moved";
  const officerNote = str(call.input.officerNote, 200);
  if (officerNote) {
    const problems = checkMarketingCompliance({ fields: { officerNote } });
    if (problems.length) return JSON.stringify({ error: "fix_and_retry", problems });
  }
  const db = readDb();
  const watchers = db.borrowerLeads.filter(
    (lead) => lead.assignedLoId === officer.id && lead.rateAlerts && !lead.rateAlerts.optedOutAt && lead.answers.contactConsent === true,
  );
  let drafted = 0;
  let alreadyQueued = 0;
  let notLicensedInState = 0;
  for (const lead of watchers) {
    if (hasOpenDraft(db.cerebroActions, lead.id, ["rate_alert_draft"])) { alreadyQueued++; continue; }
    const channel = channelFor(lead, lead.rateAlerts?.channel);
    if (!channel) continue;
    const facing = facingOfficer(lead.assignedLoId);
    if (!queueDraft(lead, "rate_alert_draft", channel, rateAlertDraft(lead, facing, channel, direction, officerNote), facing)) {
      notLicensedInState++;
      continue;
    }
    drafted++;
  }
  return JSON.stringify({
    optedIn: watchers.length,
    drafted,
    alreadyQueued,
    notLicensedInState,
    note:
      watchers.length === 0
        ? "None of their borrowers has opted in to rate alerts yet. Cerebro offers it to borrowers on the site."
        : "Drafts are in the approval queue. Nothing was sent, and no rates are quoted in them.",
  });
}

export function executeDraftPrequalLetter(call: AiToolCall, officer: LoanOfficerRecord): string {
  const name = str(call.input.borrowerName, 80)?.toLowerCase();
  const amount = typeof call.input.maxPurchasePrice === "number" ? Math.round(call.input.maxPurchasePrice) : NaN;
  const programs = new Set(["Conventional", "FHA", "VA", "USDA", "Jumbo", "DSCR", "Other"]);
  const program = programs.has(call.input.loanProgram as string) ? (call.input.loanProgram as string) : undefined;
  if (!name || !Number.isFinite(amount) || amount < 10000 || amount > 10000000 || !program) {
    return JSON.stringify({ error: "Need the borrower's name, the purchase price the officer approved, and the program." });
  }
  const matches = readDb().borrowerLeads.filter(
    (lead) => lead.assignedLoId === officer.id && (lead.answers.name ?? "").trim().toLowerCase() === name,
  );
  if (matches.length === 0) return JSON.stringify({ error: "not_found", note: "No borrower by that exact name in this officer's pipeline." });
  if (matches.length > 1) return JSON.stringify({ error: "ambiguous", note: "More than one borrower has that name. Ask which one." });
  const lead = matches[0];
  const validDays = Math.max(15, Math.min(120, typeof call.input.validDays === "number" ? Math.floor(call.input.validDays) : 90));
  const today = new Date();
  const expires = new Date(today.getTime() + validDays * DAY_MS);
  const fmt = (date: Date) => date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
  const city = str(call.input.propertyCity, 60);
  const nmls = officer.nmlsId ? `NMLS #${officer.nmlsId}` : `NMLS #${NMLS_PLACEHOLDER}`;
  const letter = [
    fmt(today),
    "",
    "Prequalification Letter",
    "",
    `Borrower: ${lead.answers.name}`,
    `Maximum purchase price: $${amount.toLocaleString("en-US")}`,
    `Loan program: ${program}`,
    city ? `Property area: ${city}` : null,
    `Valid through: ${fmt(expires)}`,
    "",
    `Based on a preliminary review of information provided by the borrower, ${lead.answers.name} is prequalified for a home purchase up to the amount above under the program listed.`,
    "",
    "This letter is not a commitment to lend or a loan approval. Final approval depends on verification of income, assets and credit, an acceptable appraisal and title, and the property meeting program guidelines. Terms may change.",
    "",
    `${officer.name}${officer.company ? `, ${officer.company}` : ""}`,
    [nmls, officer.phone, officer.email].filter(Boolean).join(" | "),
    "Equal Housing Opportunity",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  // State disclosures (e.g. California DRE) and the license-state check.
  const checked = withDisclosures(lead, officer, "email", letter);
  if ("blocked" in checked) return JSON.stringify({ error: "not_licensed_in_state", note: checked.blocked });
  const body = checked.body;
  const now = today.toISOString();
  saveCerebroAction({
    id: generateId("cba"),
    createdAt: now,
    updatedAt: now,
    loId: officer.id,
    borrowerLeadId: lead.id,
    kind: "prequal_letter_draft",
    status: "awaiting_approval",
    channel: "email",
    subject: `Your prequalification letter`,
    body,
    source: "officer_chat",
  });
  appendCrmNote(lead.id, `Cerebro: prequal letter drafted ($${amount.toLocaleString("en-US")}, ${program}, valid ${validDays} days) for the officer to sign.`);
  return JSON.stringify({
    drafted: true,
    letter: body,
    note: "Saved in the approval queue. The officer signs and sends it; Cerebro sends nothing.",
  });
}
