import type { PricingTierId } from "./pricing";

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
  /** ZIP the borrower is transacting in — not currently collected by the intake flow; optional until it is. */
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
  specialties: LoanProgram[];
  /** Simple weekly availability placeholders (minutes from midnight UTC) */
  weeklyWindows: Array<{ dow: number; startMin: number; endMin: number }>;
  calendarProvider?: CalendarProvider;
  calendarId?: string;
  calendarTimeZone?: string;
  calendlyUrl?: string;
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
  deliveryProvider?: "twilio" | "sendgrid" | "webhook" | "demo";
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
  source: "seed" | "demo_request" | "admin_adjustment";
  ownerLoId?: string;
  ownerEmail?: string;
  company?: string;
  claimedZips: string[];
  countyTerritories?: string[];
  monthlyPriceCents?: number;
  lifetimeMonths?: number;
  attributedDemoRequestIds?: string[];
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
  | "sms_email_send";

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
}
