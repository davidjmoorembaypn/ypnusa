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
  /**
   * How Cerebro handles its follow-up messages to this officer's borrowers. "live" (default):
   * it sends them itself, within the consent, opt-out and compliance checks. "approve": every
   * message waits for the officer's OK.
   */
  cerebroReplyMode?: "live" | "approve";
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
  /** Google Calendar refresh token, encrypted at rest (src/lib/google-calendar.ts). Never sent to a browser. */
  googleRefreshToken?: string;
  googleConnectedAt?: string;
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
  /** The officer's CRM ids for this lead, one per CRM link (upgrade 2). */
  externalRefs?: Array<{ connectionId: string; externalId: string }>;
  /** When the officer's CRM last changed this lead; older CRM updates are ignored. */
  crmUpdatedAt?: string;
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
  /** Missing on records made before cancelling existed: treat as "booked". */
  status?: "booked" | "cancelled";
  cancelledAt?: string;
  cancelledBy?: "borrower" | "officer" | "admin";
  /** IANA time zone the times are shown in (the officer's). */
  timeZone?: string;
  /** Set once both sides are confirmed (or a side can't be emailed). */
  confirmationSentAt?: string;
  borrowerConfirmedAt?: string;
  officerNotifiedAt?: string;
  confirmationAttempts?: number;
  reminderSentAt?: string;
  /** After a cancel: whether the event still has to come off the officer's Google or Outlook calendar. */
  providerCleanup?: "pending" | "done";
  providerCleanupAttempts?: number;
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
  /**
   * How and when the borrower agreed to be contacted, with the exact wording shown. Copied into
   * the consent ledger when the lead is created (src/lib/consent.ts).
   */
  consentCapture?: { source: string; textShown?: string; at: string; channels?: ConsentChannel[] };
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
  /** Optional since the short form: asked after the first submit (progressive profiling). */
  company?: string;
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
  /** An add-on (an extra ZIP code): holds its ZIP code but grants no plan access on its own. */
  addon?: "extra_zip";
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
  /** Set on assistant-side messages the loan officer typed during a Live Takeover (not the AI). */
  author?: "officer";
  /** First name of the officer who typed it, shown to the borrower above the message. */
  authorName?: string;
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
  /** Set for borrower chats started on a loan officer's own page (/lo/[slug]): that officer's account id and page slug. */
  officerUserId?: string;
  officerSlug?: string;
  /** Who answers the borrower: Cerebro (default) or the loan officer after a Live Takeover. */
  handledBy?: "ai" | "officer";
  /**
   * public_site only: a one-way hash of the visitor's network address (never the address), so
   * the Free visitor message cap counts one device's chats per day.
   */
  visitorKey?: string;
  /**
   * public_site only: who Cerebro is talking to, set from the tools it uses. Only "officer"
   * chats count toward the visitor cap; homebuyer chats are never capped.
   */
  audience?: "officer" | "borrower";
  handledByChangedAt?: string;
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
  /**
   * Free preview kits (preview: true) hold the bio and the blog post's title and opening only;
   * the other fields are empty and the kit page shows them as paid-plan pieces.
   */
  blogOpening?: string;
  preview?: boolean;
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
  /** sent: Cerebro emailed it. held: waiting on something (see holdReason), retried later. */
  status: "awaiting_approval" | "approved" | "dismissed" | "sent" | "held";
  sentAt?: string;
  /** When the officer approved it; kept through holds so a later send knows a person reviewed it. */
  approvedAt?: string;
  /** Why it hasn't gone out yet. On an awaiting_approval item, what the officer needs to do. */
  holdReason?: string;
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
  /** Version of the optimizer that produced the last finished run; a different version reruns on the next tick. */
  runVersion?: number;
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

/**
 * One entry in the loan officer text opt-in ledger (ypnus.com/sms-opt-in), keyed by mobile
 * number. Newest entry for a number wins: a STOP reply adds `granted: false`. Separate from the
 * borrower consent ledger above, which is keyed by borrower lead.
 */
export interface SmsOptInRecord {
  id: string;
  /** 10-digit US mobile number (encrypted at rest). */
  phone: string;
  granted: boolean;
  /** Where it came from: "lo_sms_opt_in_page", "sms_stop", "sms_start". */
  source: string;
  /** Name or business name, when given (encrypted at rest). */
  name?: string;
  /** The exact consent wording shown beside the box (encrypted at rest). */
  textShown?: string;
  /** Page the opt-in was submitted from. */
  pageUrl?: string;
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

/** A loan officer's phone or browser that receives push alerts (upgrade 3.4). */
export interface PushSubscriptionRecord {
  id: string;
  /** Account id of the officer the alerts are for. */
  userId: string;
  /** Push service URL and keys from the browser. Encrypted at rest; never logged. */
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  lastSentAt?: string;
}

/**
 * A loan officer's link to their own CRM (upgrade 2), usually through Zapier. YPN USA posts
 * lead events to outboundUrl, signed with signingSecret; the CRM posts status changes back
 * to /api/webhooks/crm/{id} with the inbound token.
 */
export interface CrmConnectionRecord {
  id: string;
  /** Account id of the officer who owns the link. */
  userId: string;
  /** Where lead events go (for example a Zapier catch hook). Encrypted at rest; never logged. */
  outboundUrl: string;
  /** Signs every outbound event (HMAC-SHA256). Encrypted at rest; never logged. */
  signingSecret: string;
  /** SHA-256 of the token the CRM sends with updates. The token itself is shown once. */
  inboundTokenHash: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastOutboundAt?: string;
  lastOutboundOk?: boolean;
  lastInboundAt?: string;
}

/** One lead event sent (or waiting to be sent) to an officer's CRM. Holds no borrower details. */
export interface CrmDeliveryRecord {
  id: string;
  connectionId: string;
  userId: string;
  event: "lead.created" | "test";
  borrowerLeadId?: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  createdAt: string;
  nextAttemptAt?: string;
  sentAt?: string;
  /** HTTP status of the last try, or 0 when it never connected. */
  lastHttpStatus?: number;
  /** Short reason code for the last failure (no URLs, no borrower details). */
  lastError?: string;
  /** Set while one server process is sending it; others leave it alone until claimUntil. */
  claimId?: string;
  claimUntil?: string;
}

/**
 * Free-plan allowance used per account per UTC day (src/lib/free-tier.ts): the one real
 * Cerebro action a free officer gets each day (a drafted post, follow-up or tool run).
 */
export interface FreeUsageRecord {
  userId: string;
  /** UTC day, YYYY-MM-DD. */
  day: string;
  actions: number;
}

/** One LinkedIn article Cerebro drafted for a loan officer to post from their own profile. */
export interface LinkedInArticleRecord {
  id: string;
  /** Calendar month it counts against, YYYY-MM (UTC). */
  month: string;
  title: string;
  /** Article body with the officer's compliance lines and borrower page link already added. */
  body: string;
  /** "ai" when Cerebro wrote it, "template" when no AI provider was available. */
  source: "ai" | "template";
  createdAt: string;
}

/**
 * The officer's marketing kit: the "Powered by YPN USA" website badge and their LinkedIn
 * article drafts. Kept apart from the onboarding record so onboarding saves can't drop it.
 */
export interface MarketingKitRecord {
  userId: string;
  /** Host of the first outside website seen showing the officer's badge (from the image request's Referer). */
  badgeHost?: string;
  badgeFirstSeenAt?: string;
  badgeLastSeenAt?: string;
  linkedinArticles: LinkedInArticleRecord[];
}

/**
 * "Neighbor lock alert": a ZIP code just locked to a paying loan officer, and the nearest ZIP codes
 * that were still open at that moment, each with ready-to-copy outreach text. Written by the
 * post-lock hook (@/lib/zip-scarcity); nothing here is ever sent automatically. Holds no name or
 * email: `ownerRef` is an opaque subscription id.
 */
export interface ZipScarcityNeighborRecord {
  zip: string;
  city: string;
  state: string;
  /** Straight-line miles between ZIP code centers. "Nearby", not "bordering". */
  miles: number;
  outreach: {
    email_fomo: { subject: string; body: string };
    linkedin_dm: { body: string };
    branch_audit_pitch: { body: string };
  };
}

export interface ZipScarcityEventRecord {
  id: string;
  createdAt: string;
  lockedZip: string;
  lockedCity: string;
  lockedState: string;
  ownerRef: string;
  trigger: "checkout" | "first_payment" | "replacement";
  neighbors: ZipScarcityNeighborRecord[];
  /** Nearby ZIP codes the ledger couldn't answer for at the time; never listed as open. */
  unknownCount: number;
  checkedCount: number;
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
  smsOptIns: SmsOptInRecord[];
  processedKeys: ProcessedKeyRecord[];
  pushSubscriptions: PushSubscriptionRecord[];
  crmConnections: CrmConnectionRecord[];
  crmDeliveries: CrmDeliveryRecord[];
  freeUsage: FreeUsageRecord[];
  marketingKits: MarketingKitRecord[];
  zipScarcityEvents: ZipScarcityEventRecord[];
}
