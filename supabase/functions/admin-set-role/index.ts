// =====================================================================
// admin-set-role — grants/revokes the admin role AND/OR sets the account
// tier (free/pro) on a profile.
//
// WHY THIS EXISTS: the DB triggers `protect_role_column` and
// `protect_tier_column` only let the service role change profiles.role /
// profiles.tier. Browser/anon-key clients (the native app's Supabase
// client) are therefore REJECTED when they try a direct
// `profiles.update({ role | tier })` — the app's "Revoke admin" silently
// did nothing (error only in logs), and the same would happen to a
// direct tier write. The website works because its API routes use the
// service role. This edge function is the SHARED, service-role path
// BOTH clients use, with caller verification + admin self-protection.
//
// Body (JSON): { userId, role?: 'customer' | 'staff' | 'admin' | 'owner', tier?: 'free' | 'pro' }
//   - At least one of role/tier must be present (both may be sent).
// Auth: the caller's bearer token must resolve to a profile with
//       role 'admin' or 'owner'. An admin can never demote THEMSELVES
//       (lockout guard). Every change is logged to activity_log.
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
    if (callerProfile?.role !== 'admin' && callerProfile?.role !== 'owner') {
      return json({ error: 'Only admins can change roles.' }, 403)
    }

    // 2) Validate the request. role and tier are both optional but at least
    //    one must be present (the app sends whichever its toggle changed).
    const body = await req.json().catch(() => null)
    const userId = String(body?.userId || '')
    const role = body?.role ?? null
    const tier = body?.tier ?? null
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'A valid user id is required.' }, 400)
    }
    if (role !== null && role !== 'admin' && role !== 'customer' && role !== 'staff' && role !== 'owner') {
      return json({ error: 'Role must be customer/staff/admin/owner.' }, 400)
    }
    if (tier !== null && tier !== 'free' && tier !== 'pro') {
      return json({ error: 'Tier must be free or pro.' }, 400)
    }
    if (role === null && tier === null) {
      return json({ error: 'Nothing to change: send role and/or tier.' }, 400)
    }

    // 3) Lockout guard: an admin can never demote themselves.
    if (userId === callerId && role === 'customer') {
      return json({ error: 'You cannot revoke your own admin role.' }, 400)
    }
    // Never allow setting 'owner' via this API (sole owner is managed via SQL)
    if (role === 'owner') {
      return json({ error: 'The owner role cannot be assigned via the API.' }, 400)
    }

    // 4) Apply via the service role (bypasses protect_role_column and
    //    protect_tier_column by design).
    const patch: Record<string, string> = {}
    if (role !== null) patch.role = role
    if (tier !== null) patch.tier = tier
    const { error: updateError } = await adminClient
      .from('profiles')
      .upsert({ id: userId, ...patch }, { ignoreDuplicates: false })
    if (updateError) {
      console.error('admin-set-role update failed:', updateError)
      return json({ error: 'Could not update the profile.' }, 500)
    }

    // 5) Audit trail (dotted vocabulary, same table both clients read) —
    //    one row per changed field so the history stays unambiguous.
    if (role !== null) {
      await adminClient.from('activity_log').insert({
        user_id: callerId,
        action: 'user.role_changed',
        entity_type: 'user',
        entity_id: userId,
        details: { role, via: 'admin-set-role' },
      })
    }
    if (tier !== null) {
      await adminClient.from('activity_log').insert({
        user_id: callerId,
        action: 'user.tier_changed',
        entity_type: 'user',
        entity_id: userId,
        details: { tier, via: 'admin-set-role' },
      })
    }

    return json({ ok: true, userId, ...(role !== null ? { role } : {}), ...(tier !== null ? { tier } : {}) })
  } catch (error) {
    console.error('admin-set-role error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
