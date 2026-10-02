# Orchid CRM (for 404 Studio)

Standalone admin site for the 404 Studio Supabase project. One file: `index.html`.

## Deploy
1. Push this repo to GitHub, then host it (Netlify, Vercel, Cloudflare Pages or GitHub Pages).
2. Supabase > Authentication > URL Configuration: add the CRM's full address to **Redirect URLs**
   (and set Site URL if this is the only site using sign-in).
3. Optional: set `CLIENT_URL` near the top of the script in `index.html` to show a "Client site" button.
4. Optional: add a `favicon.png` next to `index.html`.

## Access
Only accounts listed in the `admins` table can use it (checked by `is_admin()` and row-level security).
The Supabase URL and publishable key in the file are meant to be public; the policies protect the data.
