-- Run once in Supabase → SQL Editor
create table if not exists public.crm_email_profiles(
  user_email text primary key,
  signature jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now());
alter table public.crm_email_profiles enable row level security;
drop policy if exists own_profile on public.crm_email_profiles;
create policy own_profile on public.crm_email_profiles for all to authenticated
  using (lower(user_email)=lower(auth.jwt()->>'email')) with check (lower(user_email)=lower(auth.jwt()->>'email'));

-- Public bucket for signature logos (email apps must load the image from a public URL)
insert into storage.buckets(id,name,public) values('email-assets','email-assets',true) on conflict (id) do nothing;
drop policy if exists logo_upload on storage.objects;
create policy logo_upload on storage.objects for insert to authenticated with check (bucket_id='email-assets');
drop policy if exists logo_update on storage.objects;
create policy logo_update on storage.objects for update to authenticated using (bucket_id='email-assets');
drop policy if exists logo_read on storage.objects;
create policy logo_read on storage.objects for select using (bucket_id='email-assets');
