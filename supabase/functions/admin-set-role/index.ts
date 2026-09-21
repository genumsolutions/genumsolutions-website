// =====================================================================
// admin-set-role — grants or revokes the admin role on a profile.
//
// WHY THIS EXISTS: the DB trigger `protect_role_column` only lets the
// service role change profiles.role. Browser/anon-key clients (the
// native app's Supabase client) are therefore REJECTED when they try
// `profiles.update({ role })` — the app's "Revoke admin" silently did
// nothing (error only in logs). The website works because its API route
// uses the service role. This edge function is the SHARED, service-role
// path BOTH clients use, with caller verification + admin self-protection.
//
// Body (JSON): { userId, role: 'admin' | 'customer' }
// Auth: the caller's bearer token must resolve to a profile with
//       role = 'admin'. An admin can never demote THEMSELVES (lockout
//       guard). All changes are logged to activity_log.
//
// Deploy (dashboard or CLI):
//   supabase functions deploy admin-set-role
//   (no extra secrets — uses the project's service role + URL env vars)
// =====================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are BUILT-IN edge-function env
// vars (auto-injected by Supabase) — deploys need zero manual secrets. The
// NEXT_PUBLIC_ spelling is a fallback for projects that mirror the web env.
const supabaseUrl = Deno.env.get('NEXT_PUBLIC_SUPABASE_URL') || Deno.env.get('SUPABASE_URL') || ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
      },
    })
  }

  try {
    // 1) Authenticate the CALLER via their bearer token (never trust the body).
    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!callerToken) return json({ error: 'Sign in to change roles.' }, 401)

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.getUser(callerToken)
    const callerId = userData?.user?.id
    if (userError || !callerId) return json({ error: 'Sign in to change roles.' }, 401)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Only admins can change roles.' }, 403)
    }

    // 2) Validate the request.
    const body = await req.json().catch(() => null)
    const userId = String(body?.userId || '')
    const role = body?.role
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'A valid user id is required.' }, 400)
    }
    if (role !== 'admin' && role !== 'customer') {
      return json({ error: 'Role must be admin or customer.' }, 400)
    }

    // 3) Lockout guard: an admin can never demote themselves.
    if (userId === callerId && role === 'customer') {
      return json({ error: 'You cannot revoke your own admin role.' }, 400)
    }

    // 4) Apply via the service role (bypasses protect_role_column by design).
    const { error: updateError } = await adminClient
      .from('profiles')
      .upsert({ id: userId, role }, { ignoreDuplicates: false })
    if (updateError) {
      console.error('admin-set-role update failed:', updateError)
      return json({ error: 'Could not update the role.' }, 500)
    }

    // 5) Audit trail (dotted vocabulary, same table both clients read).
    await adminClient.from('activity_log').insert({
      user_id: callerId,
      action: 'user.role_changed',
      entity_type: 'user',
      entity_id: userId,
      details: { role, via: 'admin-set-role' },
    })

    return json({ ok: true, userId, role })
  } catch (error) {
    console.error('admin-set-role error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
