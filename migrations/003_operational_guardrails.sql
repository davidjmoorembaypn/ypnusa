-- 003_operational_guardrails.sql
-- Website Autopilot change-approval system and per-MLO agent onboarding
-- policy. Mirrors WebsiteAutopilotChange, AutopilotRunRecord,
-- AgentOnboardingRecord in src/lib/types.ts. This is the compliance-critical
-- surface: NMLS license language, rate/APR claims, and guaranteed-savings
-- copy all route through autoApplied/requiresApproval here before anything
-- publishes to the live WordPress site.

create table if not exists website_autopilot_changes (
  id                 text primary key default gen_random_uuid()::text,
  user_id            text,
  mlo_profile_id     text,
  page_type          text not null check (page_type in
                       ('profile','landing_page','seo','chatbot','lead_form')),
  change_type        text not null check (change_type in (
                       'headline','cta','chatbot_greeting','lead_form_helper_text',
                       'audience_positioning','local_market_wording','seo_title',
                       'seo_meta_description','profile_completeness','trust_copy',
                       'rate_apr_language','guaranteed_savings_language',
                       'loan_approval_language','compliance_disclosure',
                       'license_nmls_change','brand_claim_change','live_publish',
                       'paid_ad_copy','sms_email_send','platform_settings_change')),
  title              text not null,
  before_text        text,
  after_text         text not null,
  reason             text not null,
  expected_benefit   text not null,
  risk_level         text not null check (risk_level in ('low','medium','high')),
  status             text not null default 'proposed' check (status in
                       ('proposed','auto_applied','needs_approval','rejected','rolled_back')),
  auto_applied       boolean not null default false,
  requires_approval  boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  rollback_note      text,
  wordpress_post_id  integer,
  wordpress_slug     text,

  -- Hard guardrail: compliance-sensitive change types can never auto-apply,
  -- regardless of what the autopilot scorer decided. This is the backstop
  -- for the mortgage-compliance risk working-notes already flags (NMLS
  -- #787257) — a bug in the scorer should not be able to push unreviewed
  -- rate/APR or licensing language live.
  constraint chk_high_risk_requires_approval check (
    not (
      change_type in (
        'rate_apr_language','guaranteed_savings_language','loan_approval_language',
        'compliance_disclosure','license_nmls_change','brand_claim_change',
        'live_publish'
      )
      and auto_applied = true
    )
  )
);

create index if not exists idx_autopilot_changes_user on website_autopilot_changes(user_id);
create index if not exists idx_autopilot_changes_status on website_autopilot_changes(status)
  where status = 'needs_approval';

create table if not exists autopilot_runs (
  id                     text primary key default gen_random_uuid()::text,
  user_id                text,
  mlo_profile_id         text,
  page_type              text not null,
  page_label             text,
  created_at             timestamptz not null default now(),
  score                  numeric not null,
  summary_for_mlo        text not null,
  auto_applied_count     integer not null default 0,
  needs_approval_count   integer not null default 0,
  change_count           integer not null default 0,
  top_changes            jsonb not null default '[]',
  dry_run                boolean not null default true,
  wordpress_live         boolean not null default false
);

create index if not exists idx_autopilot_runs_user on autopilot_runs(user_id, created_at desc);

create table if not exists agent_onboarding (
  user_id              text primary key,
  email                text not null,
  status               text not null default 'draft' check (status in ('draft','ready','active')),
  completed_step       integer not null default 0,
  goal                 text not null check (goal in
                         ('speed_to_lead','nurture_to_booking','partner_growth')),
  goal_description     text not null,
  territory_zip        text,
  connect_email        boolean not null default false,
  connect_sms          boolean not null default false,
  connect_calendar     boolean not null default false,
  connect_crm          boolean not null default false,
  autonomy             text not null default 'approval_first' check (autonomy in
                         ('approval_first','autonomous_with_guardrails')),
  confidence_threshold numeric not null default 0.8,
  test_passed_at       timestamptz,
  activated_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- An agent cannot go autonomous without having passed its own test run.
  constraint chk_autonomous_requires_test check (
    autonomy = 'approval_first' or test_passed_at is not null
  )
);
