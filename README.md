# Hellobase CRM (Next.js)

Routes
- `/` landing page, `/login` sign in / create account / forgot password, `/privacy`, `/terms`
- `/app` the CRM (signed-in members only; access is enforced by Supabase RLS and the `crm_role` / `crm_is_admin` functions)
- `/legacy/*.html` the old HTML app, kept so Gmail, Calendar and other features not yet rebuilt stay reachable

Setup
1. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. In Supabase > Authentication > URL configuration, add `http://localhost:3000/app` and your live `/app` address to Redirect URLs.
3. Edit `lib/site.ts` (contact email) before publishing the Privacy Policy and Terms.
4. `npm install && npm run dev`

Supabase pieces expected: the SQL files in this folder, plus edge functions `orchid-reset` (deploy with `--no-verify-jwt`), `crm-google-link` (`index.ts`) and `crm-ai`.

Structure
- `app/app/` CRM: `crm-app.tsx` (shell and data), `sections.tsx` (screens), `deals-board.tsx`, `ai-panel.tsx`, `security-question.tsx`
- `lib/` shared Supabase client, types and helpers, site settings
