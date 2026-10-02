-- 404 Studio CRM: Websites workflow
-- Run this once in Supabase SQL Editor while signed in as the project owner.

create table if not exists public.websites (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_email text,
  website_name text not null,
  website_type text,
  client_request text,
  reference_links text,
  current_stage integer not null default 1 check (current_stage between 1 and 6),
  payment_status text not null default 'pending',
  payment_amount numeric(12,2),
  payment_date timestamptz,
  payment_screenshot_path text,
  payment_reference text,
  domain_name text,
  domain_provider text,
  domain_status text,
  dns_status text,
  html_status text,
  preview_url text,
  client_approved boolean not null default false,
  approval_date timestamptz,
  revision_notes text,
  crm_created boolean not null default false,
  client_access_status text,
  client_dashboard_url text,
  published boolean not null default false,
  live_url text,
  published_date timestamptz,
  seo_completed boolean not null default false,
  seo_notes text,
  google_search_console boolean not null default false,
  sitemap_url text,
  indexing_status text,
  analytics_status text,
  stage_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists websites_created_at_idx on public.websites(created_at desc);
create index if not exists websites_client_name_idx on public.websites(client_name);
create index if not exists websites_current_stage_idx on public.websites(current_stage);

alter table public.websites enable row level security;

drop policy if exists "Admins can read websites" on public.websites;
create policy "Admins can read websites" on public.websites
for select to authenticated using (public.is_admin());

drop policy if exists "Admins can create websites" on public.websites;
create policy "Admins can create websites" on public.websites
for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update websites" on public.websites;
create policy "Admins can update websites" on public.websites
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete websites" on public.websites;
create policy "Admins can delete websites" on public.websites
for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.websites to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'website-payments',
  'website-payments',
  false,
  10485760,
  array['image/png','image/jpeg','image/webp','application/pdf']
)
on conflict (id) do update
set public=false, file_size_limit=10485760,
    allowed_mime_types=array['image/png','image/jpeg','image/webp','application/pdf'];

drop policy if exists "Admins can upload website payment proofs" on storage.objects;
create policy "Admins can upload website payment proofs" on storage.objects
for insert to authenticated
with check (bucket_id='website-payments' and public.is_admin());

drop policy if exists "Admins can read website payment proofs" on storage.objects;
create policy "Admins can read website payment proofs" on storage.objects
for select to authenticated
using (bucket_id='website-payments' and public.is_admin());

drop policy if exists "Admins can update website payment proofs" on storage.objects;
create policy "Admins can update website payment proofs" on storage.objects
for update to authenticated
using (bucket_id='website-payments' and public.is_admin())
with check (bucket_id='website-payments' and public.is_admin());

drop policy if exists "Admins can delete website payment proofs" on storage.objects;
create policy "Admins can delete website payment proofs" on storage.objects
for delete to authenticated
using (bucket_id='website-payments' and public.is_admin());
