# Orchid CRM

Admin CRM for 404 Studio. A single static file (`index.html`), no build step. It talks to the
404 Studio Supabase project, so leads submitted on the client website appear here.

## Features
- **Home:** recent leads, stage funnel (weighted / total), month calendar, today's agenda, quota, top opportunities
- **Leads:** search, filters, CSV export, sales path, lead score, activity log, tasks, notes, deal value
- **Pipeline:** drag-and-drop kanban
- **Calendar, Tasks, Forecast, Reports**
- **Profile:** photo, position and contact info in the left panel
- **Shortcuts:** `Ctrl/⌘ + K` command palette, `+ New lead` button

## Deploy
1. Put `index.html` in its own repo and host it (Netlify, Vercel, Cloudflare Pages or GitHub Pages).
2. In Supabase > Authentication > URL Configuration, add the CRM's full address to **Redirect URLs**.
3. Optional: set `CLIENT_URL` near the top of the script to show a "Client site" button.
4. Optional: add a `favicon.png` next to `index.html`.

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
