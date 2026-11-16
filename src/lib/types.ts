import type { OfficerLicense } from "./compliance/rules";
import type { PricingTierId } from "./pricing";
import type { EntitlementStatus } from "./session";

export type LoanProgram =
  | "FHA"
  | "VA"
  | "CONVENTIONAL"
  | "DSCR"
  | "HELOC"
  | "REFI"
  | "JUMBO";

export type LeadQuality = "prime" | "strong" | "developing" | "watch";

export type Urgency = "critical" | "high" | "standard" | "low";

export type FollowUpPlan =
  | "immediate_confirmation_email"
  | "immediate_sms_ack"
  | "day_1_educational_email"
  | "day_3_book_call_email"
  | "day_5_urgency_email"
  | "day_30_check_in"
  | "day_60_check_in"
  | "day_90_check_in";

export type FollowUpChannel = "email" | "sms";
export type CalendarProvider = "local" | "google" | "microsoft" | "calendly";

export interface BorrowerAnswers {
  loanProgram: LoanProgram;
  name?: string;
  email?: string;
  phone?: string;
  contactConsent?: boolean;
  /** 5-digit ZIP code of the property. Asked early in the intake; routes the lead (src/lib/crm.ts routeLead). */
  zip?: string;
  /** e.g. 620-679, prefer numeric midpoint for scoring when possible */
  estimatedCreditBand?: string;
  annualIncomeUsd?: number;
  employment?: string;
  veteranStatus?: "yes" | "no" | "unsure";
  propertyType?: string;
  purchaseRefiIntent?: "purchase" | "refinance" | "unsure";
  timeline?: string;
  estimatedDownPaymentUsd?: number;
  /** FHA */
  firstTimeBuyer?: boolean;
  /** VA */
  vaCertificateOfEligibility?: "yes" | "no" | "unsure";
  /** DSCR */
  portfolioPropertyCount?: number;
  expectedMonthlyRentUsd?: number;
  /** HELOC */
  estimatedHomeValueUsd?: number;
  currentMortgageBalanceUsd?: number;
  /** Refi */
  currentRatePct?: number;
  refinanceGoal?: string;
  currentLoanBalanceUsd?: number;
  /** Jumbo */
  targetLoanAmountUsd?: number;
  liquidAssetsUsd?: number;
  /** funnel tag from marketing */
  funnelSource?: string;
}

export interface ProgramScores {
  fhaScore?: number;
  vaEligibilityScore?: number;
  investorProfileScore?: number;
  refiOpportunityScore?: number;
  overallScore?: number;
}

export interface QualificationSummary {
  programScores: ProgramScores;
  leadQuality: LeadQuality;
  urgency: Urgency;
  recommendedNextStep: string;
  rationale: string[];
}

export interface LoanOfficerRecord {
  id: string;
  name: string;
  email: string;
  /** Mirrored from the officer's onboarding profile (AgentOnboardingRecord.officerProfile). */
  nmlsId?: string;
  phone?: string;
  company?: string;
  /** Mirrored from the profile: the company's NMLS ID, state licenses and Equal Housing wording. */
  companyNmlsId?: string;
  licenses?: OfficerLicense[];
  equalHousing?: "opportunity" | "lender";
  /** Public page slug (/lo/[slug]), set once the officer saves a profile. */
  publicSlug?: string;
  specialties: LoanProgram[];
  /** Simple weekly availability placeholders (minutes from midnight UTC) */
  weeklyWindows: Array<{ dow: number; startMin: number; endMin: number }>;
  calendarProvider?: CalendarProvider;
  calendarId?: string;
  calendarTimeZone?: string;
  calendlyUrl?: string;
  /**
   * Entitlement snapshot for server-to-server contexts (automation/lead-delivery
   * jobs) that have no logged-in session to read a tier claim from — see
   * src/lib/entitlements.ts's resolveOfficerEntitlement. Both fields are
   * optional and, as of this writing, never written by any code path: there
   * is no live sync from ypnus.com's WordPress entitlement store into this
   * app's local data yet (that would be a separate integration). Until one
   * exists, an officer with no snapshot is treated as unrestricted here
   * (not gated) rather than defaulted to "free" — unlike the session-based
   * resolver, which correctly fails closed to free for a logged-in visitor.
   * The difference is deliberate: these are pre-existing internal officer
   * records with no attacker-controlled input, not a live grant a visitor
   * could claim for themselves, so defaulting to "free" here would only
   * break already-working seeded/demo automation for every current officer
   * with no way to fix it short of a real sync — see docs/sso-handoff.md.
   */
  entitlementTier?: PricingTierId;
  entitlementStatus?: EntitlementStatus;
}

export interface BorrowerLeadRecord {
  id: string;
  createdAt: string;
  funnelSource?: string;
  answers: BorrowerAnswers;
  qualification: QualificationSummary;
  assignedLoId: string;
  crmLeadId: string;
  sessionId?: string;
  /** Set when the borrower asked to hear when rates move. Alerts are still drafted for the officer to approve. */
  rateAlerts?: { channel: "text" | "email"; optedInAt: string; optedOutAt?: string };
  /** What the borrower shared toward a prequal letter (self-reported ranges, never SSN or account numbers). */
  prequalRequest?: PrequalRequest;
}

export interface PrequalRequest {
  requestedAt: string;
  targetPrice?: string;
  downPayment?: string;
  creditRange?: "excellent" | "good" | "fair" | "rebuilding" | "unsure";
  employment?: "w2" | "self_employed" | "retired" | "other";
  monthlyIncomeRange?: string;
  docsReady?: string[];
  notes?: string;
}

export interface CrmLeadRecord {
  id: string;
  createdAt: string;
  borrowerLeadId: string;
  funnelSource?: string;
  assignedLoId: string;
  status: string;
  notes: string[];
  qualificationSnapshot: QualificationSummary;
}

export interface LoAlertRecord {
  id: string;
  createdAt: string;
  loId: string;
  borrowerLeadId: string;
  loanProgram: LoanProgram;
  summary: string;
  qualificationSummary: QualificationSummary;
  suggestedAction: string;
  readAt?: string;
}

export interface ScheduledFollowUpRecord {
  id: string;
  borrowerLeadId: string;
  plan: FollowUpPlan;
  channel: FollowUpChannel;
  recipient: string;
  scheduledAt: string;
  status: "pending" | "sending" | "sent" | "failed" | "cancelled";
  bodySummary: string;
  createdAt: string;
  sentAt?: string;
  attemptCount?: number;
  deliveryProvider?: "twilio" | "sendgrid" | "resend" | "webhook" | "demo";
  providerMessageId?: string;
  lastError?: string;
}

export interface AppointmentRecord {
  id: string;
  borrowerLeadId: string;
  loId: string;
  start: string;
  end: string;
  createdAt: string;
  borrowerNotes?: string;
  provider?: CalendarProvider;
  externalEventId?: string;
  meetingUrl?: string;
  externalBookingUrl?: string;
}

export interface IntakeSessionRecord {
  id: string;
  createdAt: string;
  funnelSource: string;
  loanProgram: LoanProgram;
  answers: BorrowerAnswers;
  status: "collecting" | "qualified" | "crm_synced";
  borrowerLeadId?: string;
  crmLeadId?: string;
  /** ZIP code passed as ?zip= by the page that opened the intake; offered as a one-tap answer. */
  prefillZip?: string;
  /** Officer page slug passed as ?lo= (from /lo/[slug]); a live officer it names receives the lead. */
  officerSlug?: string;
}

export interface AnalyticsEventRecord {
  id: string;
  type:
    | "intake_started"
    | "intake_progress"
    | "intake_completed"
    | "appointment_booked"
    | "followup_processed"
    | "demo_requested"
    | "property_evaluation_saved"
    | "funnel_stage_viewed"
    | "funnel_cta_clicked"
    | "lead_intelligence_computed";
  createdAt: string;
  payload: Record<string, unknown>;
}

/** Loan-officer / brokerage territory reservation captured from the marketing site. */
export interface DemoRequestRecord {
  id: string;
  createdAt: string;
  name: string;
  workEmail: string;
  company: string;
  phone?: string;
  role?: string;
  /** Requested exclusive ZIP-code territory. */
  zip?: string;
  monthlyLeadVolume?: string;
  message?: string;
  source?: string;
  status: "new" | "contacted";
  /** Whether the submitter checked a contact-consent (TCPA) box, if the caller sent one. */
  consent?: boolean;
  consentAt?: string;
}

export interface PropertyEvaluationRecord {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone?: string;
  zip: string;
  estimatedHomeValueUsd: number;
  currentMortgageBalanceUsd: number;
  estimatedEquityUsd: number;
  illustrativeCashOutUsd: number;
  estimatedLtvPct: number;
  contactConsent: true;
  source: string;
  status: "new" | "contacted";
}

export interface RevenueSubscriptionRecord {
  id: string;
  createdAt: string;
  startedAt: string;
  tier: PricingTierId;
  status: "trialing" | "active" | "cancelled";
  source: "seed" | "demo_request" | "admin_adjustment" | "stripe_webhook";
  ownerLoId?: string;
  ownerEmail?: string;
  company?: string;
  claimedZips: string[];
  countyTerritories?: string[];
  monthlyPriceCents?: number;
  lifetimeMonths?: number;
  attributedDemoRequestIds?: string[];
  /** Set once a Stripe fulfillment event provisions/updates this record — see /api/webhooks/fulfill. */
  stripeCustomerId?: string;
  /**
   * The Stripe subscription this record tracks — the actual lookup key for fulfillment
   * events (see /api/webhooks/fulfill), not stripeCustomerId: one customer can hold more
   * than one subscription over time (e.g. a replacement created before the old one is
   * deleted), and keying by customer alone would let a delete event for a stale
   * subscription cancel the customer's current one.
   */
  stripeSubscriptionId?: string;
  /** Stripe event id last applied to this record — guards an exact-duplicate redelivery from reapplying. */
  lastStripeEventId?: string;
  /** Unix seconds (Stripe event.created) of the last applied event — an older/out-of-order event is rejected rather than overwriting newer state. */
  lastStripeEventCreatedAt?: number;
  /**
   * ZIP code chosen at a trial checkout. It is NOT locked (not in claimedZips, so it stays
   * open to others) until the first paid invoice (amount > 0) arrives; see lockZipOnPaidInvoice.
   */
  pendingZip?: string;
  /** End of a prepaid term (e.g. the 5-year plan). Past this date the plan and its ZIP code locks lapse. */
  expiresAt?: string;
  /** Stripe PaymentIntent behind a one-time prepaid purchase, so a refund can find and release it. */
  stripePaymentIntentId?: string;
  /** Set when the first payment arrived but another loan officer had already paid for pendingZip. */
  zipLockConflict?: { zip: string; at: string };
}

/** The three surfaces the AI assistant runs on — see src/lib/ai/prompts.ts. */
export type AssistantMode = "public_site" | "mlo_dashboard" | "lead_qualification";

export type ChatRole = "user" | "assistant";

export type ConsumerLeadType = "buyer" | "seller" | "refinance" | "other";

export interface ChatMessageRecord {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

/**
 * Structured slots the assistant fills in during a lead-qualification
 * conversation. Distinct from BorrowerAnswers/LoanProgram (the deterministic
 * intake flow's model) because "seller" leads aren't borrowers at all —
 * this is a lighter, chat-native shape the AI provider populates via tool use.
 */
export interface ChatCapturedFields {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  leadType?: ConsumerLeadType;
  urgency?: Urgency;
  /** Explicit contact-consent capture — required before any outbound follow-up. */
  consent?: boolean;
  /** 5-digit ZIP code of the property or search area. Routes the lead to that ZIP code's paying loan officer. */
  zip?: string;
}

export interface ChatSessionRecord {
  id: string;
  mode: AssistantMode;
  createdAt: string;
  updatedAt: string;
  /** Set for mlo_dashboard sessions — the signed-in session's `sub` (src/lib/session.ts). */
  userId?: string;
  /** Linked once a lead_qualification conversation is routed into the CRM. */
  borrowerLeadId?: string;
  crmLeadId?: string;
  funnelSource?: string;
  messages: ChatMessageRecord[];
  capturedFields: ChatCapturedFields;
  /** Populated by the AI provider once it has enough signal — see chat-agent.ts. */
  summary?: string;
  /** 0-100 lead-quality estimate, distinct from qualification.ts's program-fit scoring. */
  leadScore?: number;
  recommendedAction?: string;
  status: "active" | "qualified" | "closed";
  /** UTC day (YYYY-MM-DD) that usageCount counts model-answered messages for — the daily cap in chat-agent.ts. */
  usageDay?: string;
  usageCount?: number;
}

export type AutopilotPageType = "profile" | "landing_page" | "seo" | "chatbot" | "lead_form";

export type AutopilotChangeType =
  | "headline"
  | "cta"
  | "chatbot_greeting"
  | "lead_form_helper_text"
  | "audience_positioning"
  | "local_market_wording"
  | "seo_title"
  | "seo_meta_description"
  | "profile_completeness"
  | "trust_copy"
  | "rate_apr_language"
  | "guaranteed_savings_language"
  | "loan_approval_language"
  | "compliance_disclosure"
  | "license_nmls_change"
  | "brand_claim_change"
  | "live_publish"
  | "paid_ad_copy"
  | "sms_email_send"
  | "platform_settings_change";

export type AutopilotRiskLevel = "low" | "medium" | "high";

export type AutopilotChangeStatus =
  | "proposed"
  | "auto_applied"
  | "needs_approval"
  | "rejected"
  | "rolled_back";

export interface WebsiteAutopilotChange {
  id: string;
  userId?: string;
  mloProfileId?: string;
  pageType: AutopilotPageType;
  changeType: AutopilotChangeType;
  title: string;
  beforeText?: string;
  afterText: string;
  reason: string;
  expectedBenefit: string;
  riskLevel: AutopilotRiskLevel;
  status: AutopilotChangeStatus;
  autoApplied: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
  /** How to undo this change if it was applied — e.g. restore beforeText via the WordPress REST API. Optional: only meaningful once a change has actually been applied somewhere. */
  rollbackNote?: string;
  /** Set when this change targets a specific WordPress page/post (src/lib/wordpress.ts). */
  wordpressPostId?: number;
  wordpressSlug?: string;
}

/** Compact snapshot of a change shown in an AutopilotRunRecord's history list — avoids re-fetching full WebsiteAutopilotChange records to render history. */
export interface AutopilotRunChangeSummary {
  id: string;
  title: string;
  changeType: AutopilotChangeType;
  riskLevel: AutopilotRiskLevel;
  status: AutopilotChangeStatus;
  expectedBenefit: string;
}

/**
 * One logged run of the Website Autopilot Command Center — "YPNUS improved
 * these items for you." Distinct from WebsiteAutopilotChange (one edit): a
 * run groups everything generated together with the plan-level score/summary
 * so the MLO sees history, not a pile of individual changes to manage.
 */
export interface AutopilotRunRecord {
  id: string;
  userId?: string;
  mloProfileId?: string;
  pageType: AutopilotPageType;
  pageLabel?: string;
  createdAt: string;
  score: number;
  summaryForMlo: string;
  autoAppliedCount: number;
  needsApprovalCount: number;
  changeCount: number;
  topChanges: AutopilotRunChangeSummary[];
  /** Always true tonight — no run has ever published live. */
  dryRun: boolean;
  /** WordPress Autopilot's enabled flag at run time, for display only. */
  wordpressLive: boolean;
}

export type AgentOnboardingGoal = "speed_to_lead" | "nurture_to_booking" | "partner_growth";
export type AgentOnboardingStatus = "draft" | "ready" | "active";

/** The officer's headshot, stored at data/officer-photos/<userId>.<ext> (see src/lib/officer-profile.ts). */
export interface OfficerPhotoRecord {
  ext: "jpg" | "png" | "webp";
  bytes: number;
  updatedAt: string;
}

/** Who the loan officer is: collected in onboarding step 1 and shown on their /lo/[slug] page. */
export interface OfficerProfileRecord {
  fullName: string;
  /** NMLS ID, digits only (4-10). */
  nmlsId: string;
  /** US phone number as 10 digits (no country code). */
  phone: string;
  company?: string;
  /** The company's NMLS ID (printed next to the officer's when set). */
  companyNmlsId?: string;
  /** States the officer is licensed in; used to block messages to other states. */
  licenses?: OfficerLicense[];
  /** "lender" prints Equal Housing Lender; default Equal Housing Opportunity. */
  equalHousing?: "opportunity" | "lender";
  /** Public page slug: the name plus a short id derived from the account id. */
  slug: string;
  updatedAt: string;
}

/** Per-MLO activation policy for Cerebro's real lead-follow-up agent. */
export interface AgentOnboardingRecord {
  userId: string;
  email: string;
  status: AgentOnboardingStatus;
  completedStep: number;
  goal: AgentOnboardingGoal;
  goalDescription: string;
  territoryZip?: string;
  connections: {
    email: boolean;
    sms: boolean;
    calendar: boolean;
    crm: boolean;
  };
  autonomy: "approval_first" | "autonomous_with_guardrails";
  confidenceThreshold: number;
  testPassedAt?: string;
  activatedAt?: string;
  /** Loan officer profile (name, NMLS ID, phone, company, headshot). Optional for accounts onboarded before it existed. */
  officerProfile?: OfficerProfileRecord;
  /** Headshot metadata. Set only by the server after a validated upload (POST /api/onboarding/photo). */
  officerPhoto?: OfficerPhotoRecord;
  createdAt: string;
  updatedAt: string;
}

/** One verified live Stripe payment (an `invoice.paid` for a subscription). The invoice id is the dedupe key. */
export interface PaymentConversionRecord {
  id: string;
  eventId: string;
  recordedAt: string;
  paidAt: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  amountPaidCents: number;
  currency: string;
  billingReason?: string;
}

/** A YPN USA sign-in identity, owned by this app since the move off WordPress. */
export interface AccountRecord {
  id: string;
  /** Lowercased, trimmed. The sign-in identifier: accounts sign in with emailed one-time links, never passwords. */
  email: string;
  role: "mlo" | "admin";
  createdAt: string;
  lastLoginAt?: string;
  /** How the account first appeared: self-serve sign-up or a Stripe checkout. */
  source: "email_signup" | "stripe_checkout";
  name?: string;
}

/** A single-use emailed sign-in link. Only the SHA-256 of the token is stored. */
export interface LoginTokenRecord {
  tokenHash: string;
  email: string;
  next: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

/**
 * A first-week marketing kit Cerebro drafts live for a visiting loan officer (bio, Google Business
 * Profile copy, a first blog post and a welcome email). Drafts only: nothing here is published or sent.
 */
export interface StarterKitRecord {
  id: string;
  createdAt: string;
  /** Chat session that produced it. */
  sessionId: string;
  officerName: string;
  city: string;
  state: string;
  zip?: string;
  /** Only when the officer typed it; never invented. */
  nmlsId?: string;
  bio: string;
  gbpDescription: string;
  gbpPost: string;
  blogTitle: string;
  blogPost: string;
  welcomeEmailSubject: string;
  welcomeEmailBody: string;
  /** Lines the server added (disclosures) or reminders for the officer. */
  complianceNotes: string[];
}

/** A loan officer who talked to Cerebro on the public site and agreed to hear from YPN USA. */
export interface OfficerProspectRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  name: string;
  email?: string;
  phone?: string;
  zip?: string;
  city?: string;
  state?: string;
  planInterest?: string;
  /** True only when they said YPN USA may contact them. */
  consent: boolean;
  starterKitId?: string;
  notes?: string;
}

/**
 * Something Cerebro queued for a loan officer to approve: a borrower's callback request or a
 * drafted follow-up. Never sent automatically; approving only marks it ready for the officer.
 */
export interface CerebroQueuedActionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  loId: string;
  borrowerLeadId: string;
  kind: "callback_request" | "follow_up_draft" | "nudge_draft" | "rate_alert_draft" | "prequal_request" | "prequal_letter_draft";
  status: "awaiting_approval" | "approved" | "dismissed";
  channel: "phone" | "text" | "email";
  /** The borrower's own words for when to reach them, e.g. "weekday evenings after 6". */
  preferredWindow?: string;
  subject?: string;
  body: string;
  source: "public_chat" | "officer_chat" | "follow_up_run";
}

/**
 * A page title or search description Cerebro (or an admin) set as data, applied by
 * marketingMetadata at render time, so it goes live without a release. Every record keeps the
 * value it replaced so it can be rolled back.
 */
export interface SiteOverrideRecord {
  id: string;
  path: string;
  field: "title" | "description";
  value: string;
  /** What the page showed before (the coded default or an earlier override). */
  previousValue?: string;
  status: "proposed" | "live" | "reverted" | "rejected";
  source: "cerebro_auto" | "admin";
  reason: string;
  /** Search numbers behind the change, e.g. "1,240 impressions, 0.4% CTR, position 8.2". */
  evidence?: string;
  createdAt: string;
  appliedAt?: string;
  revertedAt?: string;
  /** Result of the live check after applying, e.g. "ok" or why it was rolled back. */
  checkResult?: string;
}

export interface SiteOptimizerState {
  lastRunAt?: string;
  lastRunSummary?: string;
}

/** Contact channels covered by the consent ledger (TCPA: texts and calls; CAN-SPAM: email). */
export type ConsentChannel = "sms" | "call" | "email" | "ai_voice";

/**
 * One consent event for one borrower and one channel. Append-only: the newest record for a
 * lead and channel wins, so the history of grants and opt-outs is kept for audit.
 */
export interface ConsentRecord {
  id: string;
  borrowerLeadId: string;
  channel: ConsentChannel;
  granted: boolean;
  /** Where it came from, e.g. "intake_form", "sms_stop", "officer_marked". */
  source: string;
  /** The exact consent wording the borrower saw, when there was one (encrypted at rest). */
  textShown?: string;
  at: string;
}

/** A webhook or job key already handled, so a retried delivery is not processed twice. */
export interface ProcessedKeyRecord {
  key: string;
  scope: string;
  at: string;
  /** Id of what the first delivery created, returned again on a duplicate. */
  ref?: string;
}

export interface DbShape {
  loanOfficers: LoanOfficerRecord[];
  sessions: IntakeSessionRecord[];
  borrowerLeads: BorrowerLeadRecord[];
  crmLeads: CrmLeadRecord[];
  loAlerts: LoAlertRecord[];
  followUps: ScheduledFollowUpRecord[];
  appointments: AppointmentRecord[];
  analyticsEvents: AnalyticsEventRecord[];
  demoRequests: DemoRequestRecord[];
  propertyEvaluations: PropertyEvaluationRecord[];
  revenueSubscriptions: RevenueSubscriptionRecord[];
  chatSessions: ChatSessionRecord[];
  websiteAutopilotChanges: WebsiteAutopilotChange[];
  autopilotRuns: AutopilotRunRecord[];
  paymentConversions: PaymentConversionRecord[];
  agentOnboarding: AgentOnboardingRecord[];
  accounts: AccountRecord[];
  loginTokens: LoginTokenRecord[];
  starterKits: StarterKitRecord[];
  officerProspects: OfficerProspectRecord[];
  cerebroActions: CerebroQueuedActionRecord[];
  siteOverrides: SiteOverrideRecord[];
  siteOptimizer: SiteOptimizerState;
  consents: ConsentRecord[];
  processedKeys: ProcessedKeyRecord[];
}
