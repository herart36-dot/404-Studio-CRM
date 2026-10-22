# Hellobase CRM

CRM for 404 Studio, backed by Supabase. The root route runs a native Next.js/React CRM. CRM section
navigation and read views are being migrated from the legacy app; records remain in Supabase.
Standalone site pages and the original app are retained under `public/` during the migration.

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

Native Next.js sections: **Today**, **Inquiries**, **Clients**, **Tasks**, **Cases**, **Messages**,
**Approvals**, **Chat**, **Sales**, **Calendar**, **Deals**, **Orders**, **Productivity**, **Team**,
**Automation**, **Members**, and **Settings**. Google sign-in and role checks, inquiry status
updates, task creation/completion, client create/edit, case status/priority changes, inbox folders,
star/read actions, supported approval decisions, and team messages are implemented. Other sections
currently show table data; their remaining workflows and complete editing controls still need
migration and live validation. Unsupported approval actions cannot be approved through this UI.

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
