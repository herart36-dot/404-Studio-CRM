// Saves the Google tokens obtained at "Continue with Google" sign-in so Gmail sync and Calendar can use them.
// Deploy: supabase functions deploy crm-google-link
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Not signed in' }, 401);

  const { access_token, refresh_token } = await req.json().catch(() => ({}));
  if (!access_token) return json({ error: 'Missing Google token' }, 400);

  // Confirm the token is real and belongs to the same Google account as this login.
  const ti = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(access_token));
  if (!ti.ok) return json({ error: 'Google rejected the token' }, 400);
  const info = await ti.json();
  if (String(info.email ?? '').toLowerCase() !== String(user.email ?? '').toLowerCase())
    return json({ error: 'Google account does not match this login' }, 403);

  const row: Record<string, unknown> = {
    user_id: user.id,
    email: user.email,
    access_token,
    scopes: info.scope ?? null,
    expires_at: new Date(Date.now() + Number(info.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (refresh_token) row.refresh_token = refresh_token; // keep the old one if Google sent none

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { error } = await admin.from('google_links').upsert(row, { onConflict: 'user_id' });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, scopes: info.scope });
});
