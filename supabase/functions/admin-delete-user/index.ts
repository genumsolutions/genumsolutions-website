// =====================================================================
// admin-delete-user — removes an auth account + its profile, mirroring
// the website's DELETE /api/admin/users for the native app.
//
// WHY THIS EXISTS: auth.admin.deleteUser needs the service role, which
// the app's anon-key Supabase client must never hold. Like
// admin-set-role, this edge function is the SHARED, service-role path
// both clients use, with caller verification.
//
// Body (JSON): { userId }
// Auth: the caller's bearer token must resolve to a profile with
//       role = 'owner'. Only the sole owner may ever delete users
//       (admins and staff can do everything else in the Users tab).
//       Self-deletion is blocked; every delete is logged to activity_log.
//
// Deploy (dashboard or CLI):
//   supabase functions deploy admin-delete-user
//   (no extra secrets — uses the project's service role + URL env vars)
// =====================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
    if (!callerToken) return json({ error: 'Sign in to delete users.' }, 401)

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: userData, error: userError } = await adminClient.auth.getUser(callerToken)
    const callerId = userData?.user?.id
    if (userError || !callerId) return json({ error: 'Sign in to delete users.' }, 401)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()
    if (callerProfile?.role !== 'owner') {
      return json({ error: 'Only the owner can delete users.' }, 403)
    }

    // 2) Validate the request.
    const body = await req.json().catch(() => null)
    const userId = String(body?.userId || '')
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: 'A valid user id is required.' }, 400)
    }
    if (userId === callerId) {
      return json({ error: 'You cannot delete your own account.' }, 400)
    }

    // 3) Delete via the service role (auth.users is invisible to the anon
    //    key by design; the profile row goes via cascade or explicit delete).
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('admin-delete-user deleteUser failed:', deleteError)
      return json({ error: deleteError.message || 'Could not delete the user.' }, 500)
    }
    // profiles is keyed on auth.users(id) — cascade usually handles it, but
    // clean up explicitly in case the FK was ever set to SET NULL.
    await adminClient.from('profiles').delete().eq('id', userId)

    // 4) Audit trail (same table/vocabulary as admin-set-role and the
    //    website's DELETE route).
    await adminClient.from('activity_log').insert({
      user_id: callerId,
      action: 'user.deleted',
      entity_type: 'user',
      entity_id: userId,
      details: { via: 'admin-delete-user' },
    })

    return json({ ok: true, userId })
  } catch (error) {
    console.error('admin-delete-user error:', error)
    return json({ error: error instanceof Error ? error.message : 'Internal error' }, 500)
  }
})
