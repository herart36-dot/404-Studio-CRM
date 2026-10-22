# Hellobase CRM

CRM for 404 Studio, backed by Supabase. The Next.js App Router provides the application entry
point; the existing HTML experience and its related pages are served from `public/` so current
features and URLs continue to work during the migration.

## Local development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. The root Next.js page hosts the existing CRM from
`public/index.html` and forwards the URL query string and hash, including the `#crm` entry point.
Other existing HTML pages remain available at their original `.html` paths.

## Features
- **Home:** recent leads, stage funnel (weighted / total), month calendar, today's agenda, quota, top opportunities
- **Leads:** search, filters, CSV export, sales path, lead score, activity log, tasks, notes, deal value
- **Pipeline:** drag-and-drop kanban
- **Calendar, Tasks, Forecast, Reports**
- **Profile:** photo, position and contact info in the left panel
- **Shortcuts:** `Ctrl/⌘ + K` command palette, `+ New lead` button

## Deploy

Build with `npm run build` and run with `npm start`, or deploy the repository to a Next.js-compatible
host such as Vercel. In Supabase > Authentication > URL Configuration, add the deployed CRM's full
address to **Redirect URLs**.

## Database
The CRM expects these in Supabase (run `supabase-setup.sql` for the Orchid-specific parts):

| Object | Purpose |
|---|---|
| `leads` | Created by the client site: name, email, service, concern, status, deal_value, follow_up_on, appointment_at, notes, `closed_at` |
| `admins` + `is_admin()` | Who may use the CRM |
| `tasks`, `activities` | To-dos and the call/email/meeting log |
| `crm_settings` | Single row: monthly quota and profile |

All CRM tables use row-level security: only admins can read or write them.

## Access
Sign in with Google. Only accounts in the `admins` table get in; everyone else sees "No admin access".
To add an admin: insert their `auth.users` id into `public.admins`.
The Supabase URL and publishable key inside `index.html` are meant to be public. The policies protect the data.

## Notes
- The profile is one shared record (fine for a single admin).
- Stage probabilities for the forecast are in the `PROB` line of the script.
