-- Run once in Supabase → SQL Editor (Gmail-style spam / trash / star on Messages)
alter table public.crm_messages add column if not exists folder text not null default 'inbox';
alter table public.crm_messages add column if not exists starred boolean not null default false;
create index if not exists crm_messages_folder_idx on public.crm_messages(folder);

-- Allow the admin to delete messages forever (skip if you already have a delete policy)
drop policy if exists crm_messages_admin_delete on public.crm_messages;
create policy crm_messages_admin_delete on public.crm_messages for delete to authenticated using (crm_is_admin());
