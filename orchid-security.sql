-- Orchid: security question + forgot-password support
-- Run once in the Supabase SQL editor of the CRM project
-- (and the Legal project too, only if people sign in there).

create extension if not exists pgcrypto with schema extensions;

-- One row per user. The answer is stored only as a salted bcrypt hash.
create table if not exists public.orchid_security (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  question        text not null,
  answer_hash     text not null,
  failed_attempts int  not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists orchid_security_email_idx on public.orchid_security (email);

-- No policies on purpose: nobody can read or write this table directly.
-- Everything goes through the functions below.
alter table public.orchid_security enable row level security;
revoke all on public.orchid_security from anon, authenticated;

-- Same clean-up for saving and checking: trim, collapse spaces, ignore capitals.
create or replace function public.orchid_sq_norm(a text) returns text
language sql immutable as $$
  select lower(regexp_replace(btrim(coalesce(a,'')), '\s+', ' ', 'g'))
$$;

-- Logged-in user: do I already have a security question?
create or replace function public.orchid_sq_status() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.orchid_security;
begin
  if auth.uid() is null then return jsonb_build_object('has', false); end if;
  select * into r from public.orchid_security where user_id = auth.uid();
  return jsonb_build_object('has', found, 'question', r.question);
end $$;

-- Logged-in user: set or change my security question and answer.
create or replace function public.orchid_sq_set(p_question text, p_answer text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  q  text := regexp_replace(btrim(coalesce(p_question,'')), '\s+', ' ', 'g');
  a  text := public.orchid_sq_norm(p_answer);
  em text;
begin
  if auth.uid() is null then raise exception 'Please log in first.'; end if;
  if length(q) < 8 or length(q) > 140 then raise exception 'The question must be 8 to 140 characters.'; end if;
  if length(a) < 4 or length(a) > 100 then raise exception 'The answer must be 4 to 100 characters.'; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  insert into public.orchid_security (user_id, email, question, answer_hash)
  values (auth.uid(), em, q, crypt(a, gen_salt('bf', 10)))
  on conflict (user_id) do update
    set email = excluded.email, question = excluded.question, answer_hash = excluded.answer_hash,
        failed_attempts = 0, locked_until = null, updated_at = now();
end $$;

-- Before login (forgot password): which question should I show for this email?
-- Unknown emails get a stand-in question so the screen does not reveal who has an account.
create or replace function public.orchid_sq_question(p_email text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  e text := lower(btrim(coalesce(p_email,'')));
  q text;
  decoys text[] := array[
    'What was the name of your first pet?',
    'What was the name of your first school?',
    'What street did you grow up on?',
    'What was the make and model of your first car?',
    'What was the name of your childhood best friend?'];
begin
  select s.question into q from public.orchid_security s where s.email = e limit 1;
  if q is not null then return q; end if;
  return decoys[1 + (abs(hashtext(e)::bigint) % array_length(decoys, 1))::int];
end $$;

-- Used only by the orchid-reset edge function (service role).
-- Checks the answer; 5 wrong answers lock that account's reset for 15 minutes.
create or replace function public.orchid_sq_check(p_email text, p_answer text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r public.orchid_security; mins int;
begin
  select * into r from public.orchid_security where email = lower(btrim(coalesce(p_email,''))) for update;
  if not found then return jsonb_build_object('ok', false); end if;
  if r.locked_until is not null and r.locked_until > now() then
    mins := greatest(1, ceil(extract(epoch from (r.locked_until - now())) / 60)::int);
    return jsonb_build_object('ok', false, 'locked', true, 'minutes', mins);
  end if;
  if r.answer_hash = crypt(public.orchid_sq_norm(p_answer), r.answer_hash) then
    update public.orchid_security set failed_attempts = 0, locked_until = null where user_id = r.user_id;
    return jsonb_build_object('ok', true, 'user_id', r.user_id);
  end if;
  update public.orchid_security
     set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
         locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
   where user_id = r.user_id;
  return jsonb_build_object('ok', false);
end $$;

-- Who may call what
revoke all on function public.orchid_sq_status()               from public, anon;
revoke all on function public.orchid_sq_set(text, text)        from public, anon;
revoke all on function public.orchid_sq_question(text)         from public;
revoke all on function public.orchid_sq_check(text, text)      from public, anon, authenticated;
grant execute on function public.orchid_sq_status()            to authenticated;
grant execute on function public.orchid_sq_set(text, text)     to authenticated;
grant execute on function public.orchid_sq_question(text)      to anon, authenticated;
grant execute on function public.orchid_sq_check(text, text)   to service_role;

notify pgrst, 'reload schema';
