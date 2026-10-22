-- Stores the Google connection (Gmail + Calendar) created at sign-in.
-- RLS is on with no policies: only Edge Functions (service role) can read or write it.
create table if not exists public.google_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  access_token text not null,
  refresh_token text,
  scopes text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.google_links enable row level security;
