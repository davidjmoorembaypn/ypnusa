import { normalizeEmail } from "@/lib/accounts";
import { findZipOwnerSubscription, HOUSE_OFFICER_ID } from "@/lib/crm";
import { readAgentOnboarding, readDb, writeDb } from "@/lib/db";
import { queueLeadForOfficer } from "@/lib/integrations/crm/link";
import { isValidZip, normalizeZip } from "@/lib/territory";
import type { BorrowerLeadRecord, CerebroQueuedActionRecord, LoanProgram } from "@/lib/types";

/**
 * The dashboard's ZIP code lead feed ("Blurred Lead Match").
 *
 * Shows REAL borrower requests only, never samples. Masking happens here, on the server:
 * a masked card is built from a short allow-list of non-contact fields, so a borrower's
 * name, phone or email never reaches a browser that hasn't paid for them (DevTools shows
 * nothing a blur hides).
 *
 * - An open ZIP code (no paying owner): requests in it sit in the house book. A loan officer
 *   sees them masked, with what they'd unlock by claiming the ZIP code.
 * - The viewer's own locked ZIP code: they see their leads in full. House requests from the
 *   last CLAIM_WINDOW_DAYS move to them the first time they open the feed after the lock
 *   (one officer per lead, which is what the borrower's consent covers).
 * - Another officer's ZIP code: no leads and no details; it's taken.
 *
 * Nothing routes leads between officers on a timer: there is no county overflow.
 */

/** Queued items that are the borrower's own requests; every other kind is a draft in an officer's name. */
const BORROWER_REQUEST_KINDS: ReadonlySet<CerebroQueuedActionRecord["kind"]> = new Set(["callback_request", "prequal_request"]);

/** How far back the feed and the one-time move to a new ZIP code owner reach. */
export const CLAIM_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;
const MAX_CARDS = 20;

export interface LeadFeedViewer {
  /** Signed-in account id (session.sub), which is also the officer id. */
  userId: string;
  email: string;
}

export interface LeadFeedCard {
  id: string;
  receivedAt: string;
  loanType: string;
  loanAmount: string;
  creditBand: string;
  timeframe: string;
  /** Present only on the viewer's own leads. */
  contact?: { name?: string; phone?: string; email?: string };
}

export interface LeadFeedResult {
  zip: string;
  status: "open" | "yours" | "taken";
  /** True when contact details were removed on the server. */
  masked: boolean;
  /** Real borrower requests that named this ZIP code in the last 7 days (any routing). */
  requestsLast7Days: number;
  cards: LeadFeedCard[];
  /** Leads moved from the house book to the viewer on this load (yours only). */
  movedToYou: number;
}

const PROGRAM_LABEL: Record<LoanProgram, string> = {
  FHA: "FHA",
  VA: "VA",
  CONVENTIONAL: "Conventional",
  DSCR: "DSCR (investor)",
  HELOC: "HELOC",
  REFI: "Refinance",
  JUMBO: "Jumbo",
};

function loanTypeLabel(lead: BorrowerLeadRecord): string {
  const program = PROGRAM_LABEL[lead.answers.loanProgram] ?? "Mortgage";
  if (lead.answers.loanProgram === "REFI" || lead.answers.loanProgram === "HELOC") return program;
  const intent = lead.answers.purchaseRefiIntent;
  if (intent === "purchase") return `Purchase · ${program}`;
  if (intent === "refinance") return `Refinance · ${program}`;
  return program;
}

function dollarsShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  return `$${Math.round(n / 1000)}k`;
}

/** A $25k band, never the exact figure the borrower typed. */
export function loanAmountBand(lead: Pick<BorrowerLeadRecord, "answers">): string {
  const a = lead.answers;
  const derived =
    a.targetLoanAmountUsd ??
    a.currentLoanBalanceUsd ??
    a.currentMortgageBalanceUsd ??
    (a.estimatedHomeValueUsd && a.estimatedDownPaymentUsd !== undefined
      ? a.estimatedHomeValueUsd - a.estimatedDownPaymentUsd
      : undefined);
  if (!derived || !Number.isFinite(derived) || derived <= 0) return "Not given yet";
  const step = 25_000;
  const low = Math.floor(derived / step) * step;
  return `${dollarsShort(low)} to ${dollarsShort(low + step)}`;
}

function cardFor(lead: BorrowerLeadRecord, withContact: boolean): LeadFeedCard {
  // Built field by field from an allow-list: never spread a lead record into a card.
  const card: LeadFeedCard = {
    id: lead.id,
    receivedAt: lead.createdAt,
    loanType: loanTypeLabel(lead),
    loanAmount: loanAmountBand(lead),
    creditBand: lead.answers.estimatedCreditBand?.trim().slice(0, 20) || "Not given yet",
    timeframe: lead.answers.timeline?.trim().slice(0, 40) || "Not given yet",
  };
  if (withContact) {
    card.contact = { name: lead.answers.name, phone: lead.answers.phone, email: lead.answers.email };
  }
  return card;
}

function leadZip(lead: BorrowerLeadRecord): string {
  return normalizeZip(lead.answers.zip);
}

function within(lead: BorrowerLeadRecord, days: number, now: Date): boolean {
  const at = Date.parse(lead.createdAt);
  return Number.isFinite(at) && at <= now.getTime() && now.getTime() - at <= days * DAY_MS;
}

function newestFirst(a: BorrowerLeadRecord, b: BorrowerLeadRecord): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

/** House requests in an open ZIP code that a new owner could take: consented, recent, still in the house book. */
function claimableHouseLeads(leads: BorrowerLeadRecord[], zip: string, now: Date): BorrowerLeadRecord[] {
  return leads.filter(
    (lead) =>
      lead.assignedLoId === HOUSE_OFFICER_ID &&
      leadZip(lead) === zip &&
      lead.answers.contactConsent === true &&
      within(lead, CLAIM_WINDOW_DAYS, now),
  );
}

/**
 * Moves recent house requests in `zip` to the officer who now holds it. Only leads that gave
 * contact consent, still sit in the house book and arrived within CLAIM_WINDOW_DAYS. Each
 * lead moves once, to one officer, and goes to their CRM link if they have one.
 */
export function moveHouseLeadsToZipOwner(officerId: string, zip: string, now: Date = new Date()): number {
  const ids = claimableHouseLeads(readDb().borrowerLeads, zip, now).map((lead) => lead.id);
  if (ids.length === 0) return 0;
  const moved: string[] = [];
  writeDb((db) => {
    for (const id of ids) {
      const lead = db.borrowerLeads.find((item) => item.id === id);
      if (!lead || lead.assignedLoId !== HOUSE_OFFICER_ID) continue;
      lead.assignedLoId = officerId;
      const crm = db.crmLeads.find((item) => item.borrowerLeadId === id);
      if (crm) {
        crm.assignedLoId = officerId;
        crm.notes.push(`Moved to the loan officer who claimed ZIP code ${zip}.`);
      }
      for (const action of db.cerebroActions) {
        if (action.borrowerLeadId !== id || action.status === "sent" || action.status === "dismissed") continue;
        if (BORROWER_REQUEST_KINDS.has(action.kind)) {
          // The borrower's own request (a callback, a prequal letter): the new officer answers it.
          action.loId = officerId;
        } else {
          // A draft written in the house officer's name: never send it for the new officer.
          action.status = "dismissed";
          action.holdReason = `Lead moved to the loan officer who claimed ZIP code ${zip}.`;
        }
        action.updatedAt = now.toISOString();
      }
      moved.push(id);
    }
  });
  for (const id of moved) queueLeadForOfficer(officerId, id);
  return moved.length;
}

/** True when the viewer holds a locked ZIP code right now (paid, not just a trial's pending pick). */
export function viewerHoldsZip(viewer: Pick<LeadFeedViewer, "email">): boolean {
  const email = normalizeEmail(viewer.email);
  if (!email) return false;
  return readDb()
    .revenueSubscriptions.filter((sub) => normalizeEmail(sub.ownerEmail) === email)
    .flatMap((sub) => sub.claimedZips)
    .some((zip) => normalizeEmail(findZipOwnerSubscription(zip)?.ownerEmail) === email);
}

/** The ZIP code the feed opens on: the viewer's own locked one, else the one they chose at onboarding. */
export function defaultFeedZip(viewer: LeadFeedViewer): string | null {
  const email = normalizeEmail(viewer.email);
  if (email) {
    const owned = readDb()
      .revenueSubscriptions.filter((sub) => normalizeEmail(sub.ownerEmail) === email && sub.status !== "cancelled")
      .flatMap((sub) => sub.claimedZips)
      .map((zip) => normalizeZip(zip))
      .find((zip) => isValidZip(zip) && findZipOwnerSubscription(zip) !== null);
    if (owned) return owned;
  }
  const chosen = normalizeZip(readAgentOnboarding(viewer.userId)?.territoryZip);
  return isValidZip(chosen) ? chosen : null;
}

export function buildZipLeadFeed(viewer: LeadFeedViewer, rawZip: unknown, now: Date = new Date()): LeadFeedResult | null {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return null;

  const requestsLast7Days = readDb().borrowerLeads.filter((lead) => leadZip(lead) === zip && within(lead, 7, now)).length;
  const owner = findZipOwnerSubscription(zip);
  const viewerEmail = normalizeEmail(viewer.email);

  if (owner && viewerEmail && normalizeEmail(owner.ownerEmail) === viewerEmail) {
    const movedToYou = moveHouseLeadsToZipOwner(viewer.userId, zip, now);
    const cards = readDb()
      .borrowerLeads.filter(
        (lead) => lead.assignedLoId === viewer.userId && leadZip(lead) === zip && within(lead, CLAIM_WINDOW_DAYS, now),
      )
      .sort(newestFirst)
      .slice(0, MAX_CARDS)
      .map((lead) => cardFor(lead, true));
    return { zip, status: "yours", masked: false, requestsLast7Days, cards, movedToYou };
  }

  if (owner) {
    // Someone else's ZIP code: nothing about its borrowers is shown.
    return { zip, status: "taken", masked: true, requestsLast7Days: 0, cards: [], movedToYou: 0 };
  }

  // An open ZIP code's requests never carry contact details, whatever the viewer's plan:
  // a request becomes an officer's only once that officer holds the ZIP code.
  const cards = claimableHouseLeads(readDb().borrowerLeads, zip, now)
    .sort(newestFirst)
    .slice(0, MAX_CARDS)
    .map((lead) => cardFor(lead, false));
  return { zip, status: "open", masked: true, requestsLast7Days, cards, movedToYou: 0 };
}
