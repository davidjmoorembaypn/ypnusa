-- 002_workflow.sql
-- Follow-up automation, revenue/territory (Stripe + ZIP claims), analytics,
-- and the two top-of-funnel capture forms. Mirrors ScheduledFollowUpRecord,
-- RevenueSubscriptionRecord, AnalyticsEventRecord, DemoRequestRecord,
-- PropertyEvaluationRecord in src/lib/types.ts.

create table if not exists scheduled_follow_ups (
  id                  text primary key default gen_random_uuid()::text,
  borrower_lead_id    text not null references borrower_leads(id),
  plan                text not null check (plan in (
                        'immediate_confirmation_email','immediate_sms_ack',
                        'day_1_educational_email','day_3_book_call_email',
                        'day_5_urgency_email','day_30_check_in',
                        'day_60_check_in','day_90_check_in')),
  channel             text not null check (channel in ('email','sms')),
  recipient           text not null,
  scheduled_at        timestamptz not null,
  status              text not null default 'pending' check (status in
                        ('pending','sending','sent','failed','cancelled')),
  body_summary        text not null,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  attempt_count       integer not null default 0,
  delivery_provider   text check (delivery_provider in ('twilio','sendgrid','webhook','demo')),
  provider_message_id text,
  last_error          text
);

create index if not exists idx_follow_ups_pending_due
  on scheduled_follow_ups(scheduled_at)
  where status = 'pending';

create index if not exists idx_follow_ups_borrower_lead
  on scheduled_follow_ups(borrower_lead_id);

create table if not exists revenue_subscriptions (
  id                          text primary key default gen_random_uuid()::text,
  created_at                  timestamptz not null default now(),
  started_at                  timestamptz not null,
  tier                        text not null,
  status                      text not null check (status in ('trialing','active','cancelled')),
  source                      text not null check (source in
                                ('seed','demo_request','admin_adjustment','stripe_webhook')),
  owner_lo_id                 text references loan_officers(id),
  owner_email                 text,
  company                     text,
  claimed_zips                text[] not null default '{}',
  county_territories          text[],
  monthly_price_cents         integer,
  lifetime_months             integer,
  attributed_demo_request_ids text[],
  stripe_customer_id          text,
  stripe_subscription_id      text unique,
  last_stripe_event_id        text,
  last_stripe_event_created_at bigint
);

-- Enforces exclusive ZIP-territory locking at the database level: one row
-- per claimed ZIP, primary-keyed, so two subscriptions can never claim the
-- same ZIP — a real constraint instead of the unguarded JSON file
-- read-modify-write in persistent-data/store.json (no flock on read).
-- claimed_zips on revenue_subscriptions above stays as a denormalized
-- display/history copy; this table is the source of truth for exclusivity.
create table if not exists zip_claims (
  zip             text primary key,
  subscription_id text not null references revenue_subscriptions(id) on delete cascade,
  claimed_at      timestamptz not null default now()
);

create index if not exists idx_zip_claims_subscription on zip_claims(subscription_id);
create index if not exists idx_revenue_subscriptions_owner_lo on revenue_subscriptions(owner_lo_id);
create index if not exists idx_revenue_subscriptions_stripe_customer on revenue_subscriptions(stripe_customer_id);

create table if not exists analytics_events (
  id          text primary key default gen_random_uuid()::text,
  type        text not null check (type in (
                'intake_started','intake_progress','intake_completed',
                'appointment_booked','followup_processed','demo_requested',
                'property_evaluation_saved','funnel_stage_viewed',
                'funnel_cta_clicked','lead_intelligence_computed')),
  created_at  timestamptz not null default now(),
  payload     jsonb not null default '{}'
);

create index if not exists idx_analytics_events_type_time on analytics_events(type, created_at);

create table if not exists demo_requests (
  id                  text primary key default gen_random_uuid()::text,
  created_at          timestamptz not null default now(),
  name                text not null,
  work_email          text not null,
  company             text not null,
  phone               text,
  role                text,
  zip                 text,
  monthly_lead_volume text,
  message             text,
  source              text,
  status              text not null default 'new' check (status in ('new','contacted')),
  consent             boolean,
  consent_at          timestamptz
);

create table if not exists property_evaluations (
  id                              text primary key default gen_random_uuid()::text,
  created_at                      timestamptz not null default now(),
  name                            text not null,
  email                           text not null,
  phone                           text,
  zip                             text not null,
  estimated_home_value_usd        numeric not null,
  current_mortgage_balance_usd    numeric not null,
  estimated_equity_usd            numeric not null,
  illustrative_cash_out_usd       numeric not null,
  estimated_ltv_pct               numeric not null,
  contact_consent                 boolean not null default true,
  source                          text not null,
  status                          text not null default 'new' check (status in ('new','contacted'))
);

create index if not exists idx_demo_requests_zip on demo_requests(zip);
create index if not exists idx_property_evaluations_zip on property_evaluations(zip);
