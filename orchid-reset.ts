// Supabase Edge Function: orchid-reset
// Resets a forgotten password when the security answer is right.
// Deploy to the CRM project WITHOUT jwt verification (the person is logged out when they call it):
//   supabase functions deploy orchid-reset --no-verify-jwt
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically by Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let b: any;
  try { b = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const email = String(b.email || '').trim().toLowerCase();
  const answer = String(b.answer || '');
  const pw = String(b.new_password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || !answer.trim()) return json({ error: 'Enter your email and your answer.' }, 400);
  if (pw.length < 8 || pw.length > 200) return json({ error: 'Password must be at least 8 characters.' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('orchid_sq_check', { p_email: email, p_answer: answer });
  if (error) { console.error(error); return json({ error: 'Something went wrong. Please try again.' }, 500); }
  if (data?.locked) return json({ error: `Too many wrong answers. Try again in ${data.minutes} minute(s).` }, 429);
  // Same message for a wrong answer and an unknown email.
  if (!data?.ok) return json({ error: 'That answer is not correct.' }, 400);

  const { error: upErr } = await admin.auth.admin.updateUserById(data.user_id, { password: pw });
  if (upErr) { console.error(upErr); return json({ error: upErr.message || 'Could not update the password.' }, 400); }
  return json({ ok: true });
});
