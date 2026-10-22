# Hellobase CRM

CRM for 404 Studio, backed by Supabase. The root route runs a native Next.js/React app. The first
migration phase includes Google sign-in, the daily overview, inquiries, clients, tasks, and cases.
Other CRM modules and standalone HTML tools remain under `public/` until their features are
migrated in later phases.

## Local development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and set the Supabase project URL and publishable/anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

Open `http://localhost:3000`. Google sign-in must also be enabled for the project in Supabase
Authentication, and the local URL must be listed in its redirect URL settings. CRM access is
checked with the existing `crm_role` and `crm_is_admin` database functions; table access continues
to be governed by Supabase row-level security.

## Migration status

Available as native Next.js screens: **Today**, **Inquiries**, **Clients**, **Tasks**, and **Cases**.
The first phase supports Google sign-in, CRM role checks, inquiry search and administrator status
updates, task creation/completion, and the daily overview. Untouched modules (including Messages,
Approvals, Chat, Sales, Calendar, Deals, Orders, Productivity, Team, Automation, and Members) remain
available through the classic CRM at `/index.html#crm` while they are migrated.

## Deploy

Build with `npm run build` and run with `npm start`, or deploy the repository to a Next.js-compatible
host such as Vercel. Set both Supabase environment variables in the host and add the deployed CRM's
full address to Supabase Authentication's **Redirect URLs**.

## Database

The migrated screens use the existing `crm_clients`, `crm_inquiries`, `crm_tasks`, and `crm_cases`
tables and check access using the existing `crm_role` and `crm_is_admin` RPCs. Keep the project's
row-level security policies enabled; the client app uses the public publishable/anon key.

The classic CRM is retained as a compatibility path during migration. Its other modules and
standalone HTML pages are not yet native Next.js screens.
