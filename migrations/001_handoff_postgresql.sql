-- 001_handoff_postgresql.sql
-- Core borrower -> loan-officer handoff pipeline: intake, qualification,
-- CRM record, LO alerting, appointments, and the AI chat sessions that feed
-- them. Mirrors src/lib/types.ts (IntakeSessionRecord, BorrowerLeadRecord,
-- CrmLeadRecord, LoAlertRecord, AppointmentRecord, ChatSessionRecord).

create extension if not exists "pgcrypto";

create table if not exists loan_officers (
  id                  text primary key,
  name                text not null,
  email               text not null unique,
  specialties         text[] not null default '{}',
  weekly_windows      jsonb not null default '[]',
  calendar_provider   text,
  calendar_id         text,
  calendar_time_zone  text,
  calendly_url        text,
  entitlement_tier    text,
  entitlement_status  text,
  created_at          timestamptz not null default now()
);

create table if not exists intake_sessions (
  id                text primary key default gen_random_uuid()::text,
  created_at        timestamptz not null default now(),
  funnel_source     text not null,
  loan_program      text not null check (loan_program in ('FHA','VA','CONVENTIONAL','DSCR','HELOC','REFI','JUMBO')),
  answers           jsonb not null,
  status            text not null default 'collecting' check (status in ('collecting','qualified','crm_synced')),
  borrower_lead_id  text,
  crm_lead_id       text
);

create table if not exists borrower_leads (
  id                text primary key default gen_random_uuid()::text,
  created_at        timestamptz not null default now(),
  funnel_source     text,
  answers           jsonb not null,
  qualification     jsonb not null,
  assigned_lo_id    text not null references loan_officers(id),
  crm_lead_id       text,
  session_id        text references intake_sessions(id)
);

alter table intake_sessions
  add constraint fk_intake_sessions_borrower_lead
  foreign key (borrower_lead_id) references borrower_leads(id) deferrable initially deferred;

create table if not exists crm_leads (
  id                      text primary key default gen_random_uuid()::text,
  created_at              timestamptz not null default now(),
  borrower_lead_id        text not null references borrower_leads(id),
  funnel_source           text,
  assigned_lo_id          text not null references loan_officers(id),
  status                  text not null default 'new',
  notes                   text[] not null default '{}',
  qualification_snapshot  jsonb not null
);

alter table borrower_leads
  add constraint fk_borrower_leads_crm_lead
  foreign key (crm_lead_id) references crm_leads(id) deferrable initially deferred;

alter table intake_sessions
  add constraint fk_intake_sessions_crm_lead
  foreign key (crm_lead_id) references crm_leads(id) deferrable initially deferred;

create table if not exists lo_alerts (
  id                      text primary key default gen_random_uuid()::text,
  created_at              timestamptz not null default now(),
  lo_id                   text not null references loan_officers(id),
  borrower_lead_id        text not null references borrower_leads(id),
  loan_program            text not null,
  summary                 text not null,
  qualification_summary   jsonb not null,
  suggested_action        text not null,
  read_at                 timestamptz
);

create table if not exists appointments (
  id                    text primary key default gen_random_uuid()::text,
  borrower_lead_id      text not null references borrower_leads(id),
  lo_id                 text not null references loan_officers(id),
  start_at              timestamptz not null,
  end_at                timestamptz not null,
  created_at            timestamptz not null default now(),
  borrower_notes        text,
  provider              text,
  external_event_id     text,
  meeting_url           text,
  external_booking_url  text
);

create table if not exists chat_sessions (
  id                text primary key default gen_random_uuid()::text,
  mode              text not null check (mode in ('public_site','mlo_dashboard','lead_qualification')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  user_id           text,
  borrower_lead_id  text references borrower_leads(id),
  crm_lead_id       text references crm_leads(id),
  funnel_source     text,
  captured_fields   jsonb not null default '{}',
  summary           text,
  lead_score        numeric,
  recommended_action text,
  status            text not null default 'active' check (status in ('active','qualified','closed'))
);

create table if not exists chat_messages (
  id          text primary key default gen_random_uuid()::text,
  session_id  text not null references chat_sessions(id) on delete cascade,
  role        text not null check (role in ('user','assistant')),
  content     text not null,
  created_at  timestamptz not null default now(),
  ordinal     integer not null
);

create index if not exists idx_borrower_leads_assigned_lo on borrower_leads(assigned_lo_id);
create index if not exists idx_crm_leads_assigned_lo on crm_leads(assigned_lo_id);
create index if not exists idx_crm_leads_status on crm_leads(status);
create index if not exists idx_lo_alerts_lo_unread on lo_alerts(lo_id) where read_at is null;
create index if not exists idx_appointments_lo_start on appointments(lo_id, start_at);
create index if not exists idx_chat_sessions_user on chat_sessions(user_id);
create index if not exists idx_chat_messages_session on chat_messages(session_id, ordinal);
