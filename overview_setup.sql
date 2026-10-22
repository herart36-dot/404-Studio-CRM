-- Orchid CRM: live Overview (targets + scheduled reports). Run once in Supabase after deals_setup.sql. Safe to re-run.
create table if not exists public.crm_targets(
  id uuid primary key default gen_random_uuid(),
  month date not null,                 -- first day of the month
  owner_email text,                    -- null = team target
  amount numeric(14,2) not null default 0 check (amount>=0),
  created_at timestamptz not null default now());
create unique index if not exists crm_targets_uq on public.crm_targets(month,coalesce(lower(owner_email),''));
create table if not exists public.crm_report_schedules(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  spec jsonb not null,                 -- {range,from,to,who,builder:{obj,group,metric,chart,fields}}
  recipients text[] not null default '{}',
  frequency text not null default 'weekly' check (frequency in ('daily','weekly','monthly')),
  active boolean not null default true,
  last_sent_at timestamptz,
  created_by text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now());
alter table public.crm_targets enable row level security;
alter table public.crm_report_schedules enable row level security;
grant select,insert,update,delete on public.crm_targets,public.crm_report_schedules to authenticated;
drop policy if exists targets_read on public.crm_targets; drop policy if exists targets_admin on public.crm_targets;
create policy targets_read on public.crm_targets for select to authenticated using (public.crm_deals_can());
create policy targets_admin on public.crm_targets for all to authenticated using (coalesce(public.crm_is_admin(),false)) with check (coalesce(public.crm_is_admin(),false));
drop policy if exists sched_all on public.crm_report_schedules;
create policy sched_all on public.crm_report_schedules for all to authenticated
  using (coalesce(public.crm_is_admin(),false) or lower(created_by)=lower(auth.jwt()->>'email'))
  with check (public.crm_deals_can());
