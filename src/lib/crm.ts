import { findAccountByEmail, normalizeEmail, upsertAccount } from "./accounts";
import { BUSINESS_EMAIL } from "./author";
import { appendBorrowerLead, appendCrmLead, readDb, writeDb } from "./db";
import { generateId } from "./id";
import { findPublicOfficerPage, officerSlug } from "./officer-profile";
import { isLiveSubscription } from "./subscription-live";
import { isValidZip, normalizeZip } from "./territory";
import type {
  AccountRecord,
  BorrowerAnswers,
  BorrowerLeadRecord,
  CrmLeadRecord,
  LoanOfficerRecord,
  LoanProgram,
  QualificationSummary,
  RevenueSubscriptionRecord,
} from "./types";

/**
 * Lead routing.
 *
 * A borrower who started on a paying loan officer's own page (/lo/[slug], passed to the
 * intake as ?lo=) goes to that officer while their page is live. Otherwise a lead goes to
 * the paying loan officer who owns the lead's ZIP code (an active or trialing subscription
 * from Stripe or an admin adjustment that claims it). Every other lead goes to the house
 * account, the owner's own book. Seeded demo officers (the
 * @loanapilot.ai roster in db.ts) never receive a lead: their names would otherwise reach
 * real borrowers through outreach.ts ("virtual assistant for <officer>").
 */

const ALL_PROGRAMS: LoanProgram[] = ["FHA", "VA", "CONVENTIONAL", "DSCR", "HELOC", "REFI", "JUMBO"];

/** Mon-Fri 9am-5pm US Pacific (daylight time), expressed in minutes from midnight UTC. */
const DEFAULT_WEEKLY_WINDOWS: LoanOfficerRecord["weeklyWindows"] = [1, 2, 3, 4, 5].map((dow) => ({
  dow,
  startMin: 16 * 60,
  endMin: 24 * 60,
}));

export const HOUSE_OFFICER_ID = "lo_house_owner";
/** Used in borrower outreach when a paying MLO hasn't given a name yet ("virtual assistant for your loan officer"). */
const PLACEHOLDER_OFFICER_NAME = "your loan officer";

const DEMO_OFFICER_IDS = new Set(["lo_jordan_lee", "lo_priya_nandakumar", "lo_mateo_rosales"]);

/** True for the seeded demo roster — never a real person a borrower should hear about. */
export function isDemoOfficer(officer: Pick<LoanOfficerRecord, "id" | "email">): boolean {
  return DEMO_OFFICER_IDS.has(officer.id) || /@loanapilot\.ai$/i.test(officer.email);
}

/**
 * The owner's own officer record: David J. Moore (NMLS 787257, CA DRE 01852847). Leads in
 * ZIPs nobody has bought land here. HOUSE_LEAD_EMAIL overrides the inbox (default
 * support@ypnus.com).
 */
export function houseOfficerRecord(): LoanOfficerRecord {
  return {
    id: HOUSE_OFFICER_ID,
    name: "David J. Moore",
    email: normalizeEmail(process.env.HOUSE_LEAD_EMAIL) ?? BUSINESS_EMAIL,
    specialties: [...ALL_PROGRAMS],
    weeklyWindows: DEFAULT_WEEKLY_WINDOWS,
    // The house book is the owner's own; its follow-ups are not plan-limited.
    entitlementTier: "elite",
    entitlementStatus: "active",
  };
}

/**
 * The name a borrower sees in outreach for this officer. A seeded demo officer is replaced
 * by the house officer outside tests/dev, so a made-up name never reaches a real person.
 */
export function borrowerFacingOfficer(officer: LoanOfficerRecord): LoanOfficerRecord {
  if (process.env.NODE_ENV === "production" && isDemoOfficer(officer)) return houseOfficerRecord();
  return officer;
}

/** Officer fields that come from the officer's own onboarding profile. */
type ProfileMirror = Pick<LoanOfficerRecord, "nmlsId" | "phone" | "company" | "publicSlug"> & { profileName?: string };

function profileMirrorFor(accountId: string): ProfileMirror {
  const profile = readDb().agentOnboarding.find((record) => record.userId === accountId)?.officerProfile;
  if (!profile) return {};
  return {
    profileName: profile.fullName,
    nmlsId: profile.nmlsId,
    phone: profile.phone,
    company: profile.company,
    publicSlug: officerSlug(profile.fullName, accountId),
  };
}

/** Inserts or refreshes an officer record (matched by id) in the store. */
function upsertOfficer(record: LoanOfficerRecord, mirror: ProfileMirror = {}): LoanOfficerRecord {
  const { profileName, ...profileFields } = mirror;
  writeDb((db) => {
    const index = db.loanOfficers.findIndex((officer) => officer.id === record.id);
    if (index === -1) {
      db.loanOfficers.push({ ...record, ...(profileName ? { name: profileName } : {}), ...profileFields });
      return;
    }
    const current = db.loanOfficers[index];
    // Keep anything the officer configured (calendar, windows, specialties); refresh identity
    // and the entitlement snapshot that server-side automation reads. A name the officer
    // gave in their own profile always wins.
    db.loanOfficers[index] = {
      ...current,
      name: profileName || (current.name && current.name !== PLACEHOLDER_OFFICER_NAME ? current.name : record.name),
      email: record.email,
      entitlementTier: record.entitlementTier,
      entitlementStatus: record.entitlementStatus,
      ...(profileName ? profileFields : {}),
    };
  });
  return readDb().loanOfficers.find((officer) => officer.id === record.id) ?? record;
}

export function ensureHouseOfficer(): LoanOfficerRecord {
  return upsertOfficer(houseOfficerRecord());
}

/**
 * Makes sure a paying account has an officer record whose id is the account id (the same
 * value as the session's `sub`), so /portal/nurture and the dashboard show that MLO the
 * leads routed to them. Called when the Stripe webhook provisions the account and again
 * whenever a lead is routed to them.
 */
export function ensureOfficerForAccount(
  account: Pick<AccountRecord, "id" | "email" | "name">,
  subscription?: Pick<RevenueSubscriptionRecord, "tier" | "status" | "company">,
): LoanOfficerRecord {
  return upsertOfficer(
    {
      id: account.id,
      name: account.name?.trim() || subscription?.company?.trim() || PLACEHOLDER_OFFICER_NAME,
      email: account.email,
      specialties: [...ALL_PROGRAMS],
      weeklyWindows: DEFAULT_WEEKLY_WINDOWS,
      ...(subscription && subscription.status !== "cancelled"
        ? { entitlementTier: subscription.tier, entitlementStatus: subscription.status }
        : {}),
    },
    profileMirrorFor(account.id),
  );
}

const ROUTING_SOURCES = new Set<RevenueSubscriptionRecord["source"]>(["stripe_webhook", "admin_adjustment"]);

/** The live paid subscription that locks at least one ZIP code for this email, oldest first. */
function liveZipSubscriptionForEmail(rawEmail: unknown): RevenueSubscriptionRecord | null {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;
  return (
    readDb()
      .revenueSubscriptions.filter(
        (subscription) =>
          ROUTING_SOURCES.has(subscription.source) &&
          (subscription.status === "active" || subscription.status === "trialing") &&
          isLiveSubscription(subscription) &&
          subscription.claimedZips.length > 0 &&
          normalizeEmail(subscription.ownerEmail) === email,
      )
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0] ?? null
  );
}

/**
 * Copies the officer's onboarding profile (name, NMLS ID, phone, company, page slug) onto
 * their CRM officer record. An officer record is created only for an account with a live
 * paid plan; for anyone else the profile simply waits on the onboarding record and is
 * picked up by ensureOfficerForAccount when they subscribe.
 */
export function syncOfficerProfile(accountId: string): LoanOfficerRecord | null {
  const db = readDb();
  const account = db.accounts.find((entry) => entry.id === accountId);
  const existing = db.loanOfficers.find((officer) => officer.id === accountId);
  if (!account) return null;
  const subscription = liveZipSubscriptionForEmail(account.email);
  if (subscription) return ensureOfficerForAccount(account, subscription);
  if (!existing) return null;
  // No live plan: refresh only the profile fields and leave the entitlement snapshot alone.
  const { profileName, ...profileFields } = profileMirrorFor(accountId);
  if (!profileName) return existing;
  writeDb((store) => {
    const officer = store.loanOfficers.find((entry) => entry.id === accountId);
    if (officer) Object.assign(officer, { name: profileName, ...profileFields });
  });
  return readDb().loanOfficers.find((officer) => officer.id === accountId) ?? null;
}

/** The live paid subscription that holds this ZIP, if any (oldest claim wins). */
export function findZipOwnerSubscription(rawZip: unknown): RevenueSubscriptionRecord | null {
  const zip = normalizeZip(rawZip);
  if (!isValidZip(zip)) return null;
  const owners = readDb()
    .revenueSubscriptions.filter(
      (subscription) =>
        ROUTING_SOURCES.has(subscription.source) &&
        (subscription.status === "active" || subscription.status === "trialing") &&
        // A prepaid term past its expiresAt no longer holds its ZIP code (same rule as the ledger).
        isLiveSubscription(subscription) &&
        subscription.claimedZips.some((claim) => normalizeZip(claim) === zip),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return owners[0] ?? null;
}

export interface LeadRoute {
  officer: LoanOfficerRecord;
  /**
   * officer_page: the borrower started from a paying MLO's own /lo/[slug] page.
   * zip_owner: the paying MLO who holds the lead's ZIP code. house: no owner, so the owner's own book.
   */
  reason: "officer_page" | "zip_owner" | "house";
}

/** The paying officer behind a /lo/[slug] page, when that page is live (profile + a locked ZIP code). */
function officerForPageSlug(slug: unknown): LoanOfficerRecord | null {
  const page = findPublicOfficerPage(slug);
  if (!page) return null;
  const account = readDb().accounts.find((entry) => entry.id === page.userId);
  if (!account) return null;
  const subscription = liveZipSubscriptionForEmail(account.email);
  if (!subscription) return null;
  const officer = ensureOfficerForAccount(account, subscription);
  return isDemoOfficer(officer) ? null : officer;
}

function officerForSubscription(subscription: RevenueSubscriptionRecord): LoanOfficerRecord | null {
  const db = readDb();
  if (subscription.ownerLoId) {
    const linked = db.loanOfficers.find((officer) => officer.id === subscription.ownerLoId);
    if (linked && !isDemoOfficer(linked)) return linked;
  }
  const email = normalizeEmail(subscription.ownerEmail);
  if (!email) return null;
  const account = findAccountByEmail(email) ?? upsertAccount({ email, source: "stripe_checkout" });
  return ensureOfficerForAccount(account, subscription);
}

/** Picks who receives a new borrower lead. See the module comment for the rules. */
export function routeLead(input: { program: LoanProgram; zip?: unknown; officerSlug?: unknown }): LeadRoute {
  if (input.officerSlug) {
    const pageOfficer = officerForPageSlug(input.officerSlug);
    if (pageOfficer) return { officer: pageOfficer, reason: "officer_page" };
  }
  const subscription = findZipOwnerSubscription(input.zip);
  if (subscription) {
    const officer = officerForSubscription(subscription);
    if (officer) return { officer, reason: "zip_owner" };
  }
  return { officer: ensureHouseOfficer(), reason: "house" };
}

/** Back-compat wrapper: the officer routeLead picks. */
export function routeLoanOfficer(program: LoanProgram, zip?: unknown): LoanOfficerRecord {
  return routeLead({ program, zip }).officer;
}

export interface CrmSyncResult {
  borrowerLeadId: string;
  crmLeadId: string;
  assignedLoId: string;
  notes: string[];
}

export function logCrmActivity(
  answers: BorrowerAnswers,
  qualification: QualificationSummary,
  assignedLoId: string,
  funnelSource?: string,
  sessionId?: string,
): CrmSyncResult {
  const borrowerId = generateId("lead");

  /** CRM mirrored notes emulate Salesforce / HubSpot custom fields */
  const notes = [
    `Funnel cohort: ${funnelSource ?? "unspecified_ai_channel"}`,
    `LOS composite ${Math.round(qualification.programScores.overallScore ?? 0)} / quality ${qualification.leadQuality}`,
    `AI coaching: ${qualification.recommendedNextStep}`,
    `Session lineage: ${sessionId ?? borrowerId}`,
  ];

  qualification.rationale.slice(0, 4).forEach((bullet) => notes.push(`Model note ▸ ${bullet}`));

  const lead: BorrowerLeadRecord = {
    id: borrowerId,
    createdAt: new Date().toISOString(),
    funnelSource,
    assignedLoId,
    qualification,
    crmLeadId: "",
    answers,
    sessionId,
  };

  const crm: CrmLeadRecord = {
    id: generateId("crm"),
    createdAt: new Date().toISOString(),
    borrowerLeadId: borrowerId,
    funnelSource,
    assignedLoId,
    status: "new_ai_routed",
    notes,
    qualificationSnapshot: qualification,
  };

  lead.crmLeadId = crm.id;

  appendBorrowerLead(lead);
  appendCrmLead(crm);

  return { borrowerLeadId: borrowerId, crmLeadId: crm.id, assignedLoId, notes };
}
